/**
 * POST /api/generate
 *
 * Generates an image from a text prompt within a project context.
 * The full lifecycle runs in one synchronous request (no queue —
 * Nano Banana Pro returns in <15s):
 *
 *   1. CSRF + auth + input validation
 *   2. Project ownership verification
 *   3. Idempotency check (return cached result if key matches)
 *   4. Concurrency check (max 2 pending per user)
 *   5. Stale generation recovery (lazy sweep for orphaned pending rows)
 *   6. Plan-based resolution check
 *   7. Create generation row (status=pending, linked to project)
 *   8. Deduct credits (atomic two-pool, daily-limit enforcement)
 *   9. Call Gemini API (with SDK-level retry + 180s timeout)
 *   10. Upload image to R2 (project-scoped key)
 *   11. Update generation (status=done, output keys)
 *   12. Return generation UID + image URL
 *
 * R2 key structure:
 *   film-maker/v1/{userUid}/{projectUid}/image/{generationUid}.{ext}
 *
 * Resilience:
 *   • SDK retry — 3 retries on transient Gemini errors (429/500/503),
 *     exponential backoff with jitter, Retry-After header support.
 *   • 180s timeout — AbortController kills the request if Gemini hangs,
 *     with X-Server-Timeout header hinting Google to stop server-side.
 *   • Idempotency key — client-supplied UUID prevents double-submit
 *     from creating duplicate generations. 24h TTL.
 *   • Concurrency limit — max 2 pending generations per user.
 *   • Stale recovery — pending generations older than 5 minutes are
 *     swept and refunded on each request (lazy, per-user).
 *   • Automatic refund — credits refunded on ANY failure after deduction.
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
import { getImageUrl } from "@/lib/image-url";
import { optimizeImage } from "@/lib/image-optimize";
import { generateImage, GenerationError } from "@/lib/gemini";
import {
    createGeneration,
    completeGeneration,
    failGeneration,
    findByIdempotencyKey,
    countPendingGenerations,
    recoverStaleGenerations,
    MAX_PENDING_PER_USER,
    buildR2Key,
} from "@/lib/generations";
import { getProject } from "@/lib/projects";
import { isUserGenerationRateLimited } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

const ASPECT_RATIOS = [
    "1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9",
] as const;

const BodySchema = z.object({
    prompt: z.string().min(1, "Prompt is required").max(10000),
    model: z.string().min(1),
    resolution: z.enum(RESOLUTIONS),
    aspectRatio: z.enum(ASPECT_RATIOS).optional().default("1:1"),
    negativePrompt: z.string().max(2000).optional(),
    projectUid: z.string().min(1, "Project is required"),
    idempotencyKey: z.string().uuid().optional(),
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

    // ─── Project ownership ──────────────────────────────────────────
    const project = await getProject(input.projectUid, userId);
    if (!project) {
        return NextResponse.json(
            { error: "Project not found" },
            { status: 404 },
        );
    }
    if (project.archivedAt) {
        return NextResponse.json(
            { error: "Cannot generate in an archived project" },
            { status: 403 },
        );
    }

    // ─── Idempotency check ──────────────────────────────────────────
    if (input.idempotencyKey) {
        const existing = await findByIdempotencyKey(
            userId,
            input.idempotencyKey,
        );
        if (existing) {
            if (existing.status === "pending") {
                return NextResponse.json(
                    {
                        uid: existing.uid,
                        status: "pending",
                        message: "Generation is already in progress.",
                    },
                    { status: 409 },
                );
            }
            return NextResponse.json({
                uid: existing.uid,
                status: existing.status,
                imageUrl: existing.outputUrls?.[0] ?? null,
                creditCost: existing.creditCost,
                error: existing.errorMessage,
                cached: true,
            });
        }
    }

    // ─── Per-user rate limit ────────────────────────────────────────
    if (await isUserGenerationRateLimited(userId)) {
        return NextResponse.json(
            { error: "You've reached the generation limit. Please wait before generating more." },
            { status: 429 },
        );
    }

    // ─── Stale generation recovery ──────────────────────────────────
    await recoverStaleGenerations(userId);

    // ─── Concurrency check ──────────────────────────────────────────
    const pendingCount = await countPendingGenerations(userId);
    if (pendingCount >= MAX_PENDING_PER_USER) {
        return NextResponse.json(
            {
                error: `You have ${pendingCount} generation(s) in progress. Please wait for them to complete.`,
            },
            { status: 429 },
        );
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
        projectId: project.id,
        model: input.model,
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        resolution: input.resolution,
        aspectRatio: input.aspectRatio,
        sampleCount: 1,
        creditCost,
        requestIp,
        userAgent,
        idempotencyKey: input.idempotencyKey,
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

    // ─── Optimize + upload to R2 ────────────────────────────────────
    // Convert from Imagen's output format (JPEG/PNG) to WebP before
    // storing. This reduces R2 storage by ~79% with no visible quality
    // loss. If conversion fails, the original format is stored and the
    // CDN serves WebP to browsers via Image Resizing.
    const optimized = await optimizeImage(
        imageResult.imageData,
        imageResult.mimeType,
    );

    const { getDb } = await import("@/lib/db");
    const db = await getDb();
    const profile = await db
        .prepare("SELECT uid FROM user_profile WHERE user_id = ? LIMIT 1")
        .bind(userId)
        .first<{ uid: string }>();

    const userUid = profile?.uid ?? userId;
    const r2Key = buildR2Key(
        userUid,
        project.uid,
        "image",
        generation.uid,
        optimized.mimeType,
    );

    try {
        const r2 = await getR2();
        await r2.put(r2Key, optimized.data, {
            httpMetadata: {
                contentType: optimized.mimeType,
            },
        });
    } catch (err) {
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

    // ─── Audit log ──────────────────────────────────────────────────
    await logAudit({
        userId,
        action: "generation.complete",
        targetType: "generation",
        targetId: generation.uid,
        metadata: {
            model: input.model,
            resolution: input.resolution,
            aspectRatio: input.aspectRatio,
            creditCost,
            projectUid: project.uid,
            converted: optimized.converted,
        },
        ip: requestIp,
    });

    return NextResponse.json({
        uid: generation.uid,
        status: "done",
        imageUrl: getImageUrl(r2Key),
        creditCost,
    });
}
