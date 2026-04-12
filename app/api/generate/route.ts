/**
 * POST /api/generate
 *
 * Generates an image from a text prompt. The full lifecycle runs in one
 * request (no queue — Nano Banana Pro returns in <15s):
 *
 *   1. Auth + input validation
 *   2. Plan-based resolution check
 *   3. Create generation row (status=pending)
 *   4. Deduct credits (atomic two-pool, daily-limit enforcement)
 *   5. Call Gemini API
 *   6. Upload image to R2
 *   7. Update generation (status=done, output keys)
 *   8. Return generation UID + image URL
 *
 * If steps 5-6 fail, credits are refunded and the generation is marked
 * as failed. The user never loses credits for a failed generation.
 *
 * Security:
 *   • Session-authenticated + onboarding check
 *   • Origin-validated (CSRF defense)
 *   • Prompt length capped at 10,000 chars
 *   • Resolution validated against user's plan tier
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import { getR2 } from "@/lib/db";
import {
    getBalance,
    deductCredits,
    refundCredits,
    InsufficientCreditsError,
    DailyLimitError,
    type DeductionResult,
} from "@/lib/credits";
import {
    computePhotoCreditCost,
    isResolutionAllowedForPlan,
    RESOLUTIONS,
    type Resolution,
} from "@/lib/constants";
import { generateImage, GenerationError } from "@/lib/gemini";
import {
    createGeneration,
    completeGeneration,
    failGeneration,
    buildR2Key,
} from "@/lib/generations";

const ASPECT_RATIOS = [
    "1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9",
] as const;

const BodySchema = z.object({
    prompt: z.string().min(1, "Prompt is required").max(10000),
    model: z.string().min(1),
    resolution: z.enum(RESOLUTIONS),
    aspectRatio: z.enum(ASPECT_RATIOS).optional().default("1:1"),
    negativePrompt: z.string().max(2000).optional(),
    projectId: z.number().int().positive().optional(),
});

export async function POST(request: Request): Promise<Response> {
    // ─── CSRF ───────────────────────────────────────────────────────
    const originError = validateOrigin(request);
    if (originError) return originError;

    // ─── Auth ───────────────────────────────────────────────────────
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!session.user.name) {
        return NextResponse.json(
            { error: "Complete onboarding first" },
            { status: 403 },
        );
    }
    const userId = session.user.id;

    // ─── Input validation ───────────────────────────────────────────
    let input: z.infer<typeof BodySchema>;
    try {
        const body = await request.json();
        input = BodySchema.parse(body);
    } catch (err) {
        const message =
            err instanceof z.ZodError
                ? err.issues.map((i) => i.message).join("; ")
                : "Invalid request body";
        return NextResponse.json({ error: message }, { status: 400 });
    }

    // ─── Plan-based resolution check ────────────────────────────────
    const balance = await getBalance(userId);
    if (!isResolutionAllowedForPlan(balance.plan, input.resolution)) {
        return NextResponse.json(
            {
                error: `${input.resolution} resolution is not available on your plan. Upgrade for higher resolution.`,
            },
            { status: 403 },
        );
    }

    // ─── Credit cost ────────────────────────────────────────────────
    const creditCost = computePhotoCreditCost(
        input.model,
        input.resolution as Resolution,
        1, // sampleCount — always 1 for v0
    );

    // ─── Create generation row (pending) ────────────────────────────
    const requestIp =
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for") ??
        null;
    const userAgent = request.headers.get("user-agent");

    const generation = await createGeneration({
        userId,
        model: input.model,
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        resolution: input.resolution,
        aspectRatio: input.aspectRatio,
        sampleCount: 1,
        creditCost,
        requestIp,
        userAgent,
    });

    // ─── Deduct credits ─────────────────────────────────────────────
    let deduction: DeductionResult;
    try {
        deduction = await deductCredits({
            userId,
            cost: creditCost,
            generationId: generation.id,
            description: `Image: ${input.model}, ${input.resolution}, ${input.aspectRatio}`,
        });
    } catch (err) {
        // Clean up the pending generation row.
        await failGeneration(generation.id, "Credit deduction failed");

        if (err instanceof InsufficientCreditsError) {
            return NextResponse.json(
                { error: err.message },
                { status: 402 },
            );
        }
        if (err instanceof DailyLimitError) {
            return NextResponse.json(
                { error: err.message },
                { status: 429 },
            );
        }
        throw err;
    }

    // ─── Generate image via Gemini ───────────────────────────────────
    let imageResult;
    try {
        imageResult = await generateImage({
            prompt: input.prompt,
            negativePrompt: input.negativePrompt,
            modelId: input.model,
            resolution: input.resolution as Resolution,
            aspectRatio: input.aspectRatio,
        });
    } catch (err) {
        // Refund credits and mark generation as failed.
        await refundCredits({
            userId,
            cost: creditCost,
            generationId: generation.id,
            deduction,
        });

        const message =
            err instanceof GenerationError
                ? err.message
                : "Image generation failed. Please try again.";

        await failGeneration(generation.id, message);

        console.error("[api/generate] Gemini error:", err);

        return NextResponse.json(
            { error: message },
            {
                status:
                    err instanceof GenerationError &&
                    err.code === "quota_exceeded"
                        ? 429
                        : 500,
            },
        );
    }

    // ─── Upload to R2 ───────────────────────────────────────────────
    // Get user profile UID for the R2 key path.
    const { getDb } = await import("@/lib/db");
    const db = await getDb();
    const profile = await db
        .prepare("SELECT uid FROM user_profile WHERE user_id = ? LIMIT 1")
        .bind(userId)
        .first<{ uid: string }>();

    const userUid = profile?.uid ?? userId;
    const r2Key = buildR2Key(userUid, generation.uid, 0, imageResult.mimeType);

    try {
        const r2 = await getR2();
        await r2.put(r2Key, imageResult.imageData, {
            httpMetadata: {
                contentType: imageResult.mimeType,
            },
        });
    } catch (err) {
        // R2 upload failed — refund and mark as failed.
        await refundCredits({
            userId,
            cost: creditCost,
            generationId: generation.id,
            deduction,
        });
        await failGeneration(generation.id, "Image storage failed");
        console.error("[api/generate] R2 upload error:", err);
        return NextResponse.json(
            { error: "Failed to store the generated image. Please try again." },
            { status: 500 },
        );
    }

    // ─── Complete generation ────────────────────────────────────────
    await completeGeneration(generation.id, [r2Key]);

    return NextResponse.json({
        uid: generation.uid,
        status: "done",
        imageUrl: `${process.env.NEXT_PUBLIC_STORAGE_URL ?? "https://storage.film-maker.net"}/${r2Key}`,
        creditCost,
    });
}
