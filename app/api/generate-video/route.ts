/**
 * POST /api/generate-video
 *
 * Generates a video from a text prompt within a project context.
 * Similar to /api/generate but uses the Veo model family.
 *
 * Video generation is async (long-running operation): the Gemini client
 * submits the job, polls until completion (~30–60s), downloads the
 * video, uploads to R2, then returns the URL.
 *
 * Flow:
 *   1. CSRF + auth + input validation
 *   2. Project ownership verification
 *   3. Idempotency check
 *   4. Concurrency check (max 2 pending per user)
 *   5. Stale generation recovery
 *   6. Create generation row (status=pending, kind=video)
 *   7. Deduct credits
 *   8. Call Veo API (submit + poll + download)
 *   9. Upload video to R2
 *   10. Update generation (status=done)
 *   11. Return generation UID + video URL
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import { getR2 } from "@/lib/db";
import {
    deductCredits,
    refundCredits,
    InsufficientCreditsError,
    DailyLimitError,
    type DeductionResult,
} from "@/lib/credits";
import { computeVideoCreditCost, VIDEO_MODELS } from "@/lib/constants";
import { getImageUrl } from "@/lib/image-url";
import { generateVideo, GenerationError } from "@/lib/gemini";
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

const VIDEO_ASPECT_RATIOS = ["16:9", "9:16"] as const;

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
] as const;

/** Maximum base64 size per reference image (~10 MB raw → ~13.3 MB base64). */
const MAX_IMAGE_BASE64_LENGTH = 14_000_000;

const VIDEO_MODEL_IDS = VIDEO_MODELS.map((m) => m.id) as [string, ...string[]];

const ReferenceImageSchema = z.object({
    data: z.string().max(MAX_IMAGE_BASE64_LENGTH, "Image too large (max 10 MB)"),
    mimeType: z.enum(ALLOWED_IMAGE_TYPES),
});

const BodySchema = z.object({
    prompt: z.string().min(1, "Prompt is required").max(10000),
    model: z.enum(VIDEO_MODEL_IDS),
    aspectRatio: z.enum(VIDEO_ASPECT_RATIOS).optional().default("16:9"),
    durationSeconds: z.number().int().min(4).max(8).optional().default(8),
    projectUid: z.string().min(1, "Project is required"),
    idempotencyKey: z.string().uuid().optional(),
    sampleCount: z.number().int().min(1).max(4).optional().default(1),
    /** Starting frame for image-to-video generation. */
    referenceImage: ReferenceImageSchema.optional(),
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
                        message: "Video generation is already in progress.",
                    },
                    { status: 409 },
                );
            }
            return NextResponse.json({
                uid: existing.uid,
                status: existing.status,
                videoUrl: existing.outputUrls?.[0] ?? null,
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

    // ─── Credit cost ────────────────────────────────────────────────
    const creditCost = computeVideoCreditCost(input.model, input.sampleCount);

    // ─── Create generation row (pending) ────────────────────────────
    const requestIp =
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for") ??
        null;
    const userAgent = request.headers.get("user-agent");

    const generation = await createGeneration({
        userId,
        projectId: project.id,
        kind: "video",
        model: input.model,
        prompt: input.prompt,
        resolution: "1K",
        aspectRatio: input.aspectRatio,
        sampleCount: input.sampleCount,
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
            description: `Video: ${input.model}, ${input.aspectRatio}, ${input.durationSeconds}s`,
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

    // ─── Generate video(s) via Veo ────────────────────────────────────
    let videoResults: Awaited<ReturnType<typeof generateVideo>>;
    try {
        videoResults = await generateVideo({
            prompt: input.prompt,
            modelId: input.model,
            aspectRatio: input.aspectRatio,
            durationSeconds: input.durationSeconds,
            sampleCount: input.sampleCount,
            referenceImage: input.referenceImage,
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
                : "Video generation failed. Please try again.";

        await failGeneration(generation.id, message);

        console.error("[api/generate-video] Veo error:", err);

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

    // ─── Upload to R2 ─────────────────────────────────────────────────

    const { getDb } = await import("@/lib/db");
    const db = await getDb();
    const profile = await db
        .prepare("SELECT uid FROM user_profile WHERE user_id = ? LIMIT 1")
        .bind(userId)
        .first<{ uid: string }>();

    const userUid = profile?.uid ?? userId;
    const r2Keys: string[] = [];

    try {
        const r2 = await getR2();
        for (let i = 0; i < videoResults.length; i++) {
            const vid = videoResults[i];
            const suffix = videoResults.length > 1 ? `-${i}` : "";
            const r2Key = buildR2Key(
                userUid,
                project.uid,
                "video",
                `${generation.uid}${suffix}`,
                vid.mimeType,
            );
            await r2.put(r2Key, vid.videoData, {
                httpMetadata: { contentType: vid.mimeType },
            });
            r2Keys.push(r2Key);
        }
    } catch (err) {
        await refundCredits({
            userId,
            cost: creditCost,
            generationId: generation.id,
            deduction,
        });
        await failGeneration(generation.id, "Video storage failed");
        console.error("[api/generate-video] R2 upload error:", err);
        return NextResponse.json(
            { error: "Failed to store the generated video. Please try again." },
            { status: 500 },
        );
    }

    // ─── Complete generation ────────────────────────────────────────
    await completeGeneration(generation.id, r2Keys);

    // ─── Audit log ──────────────────────────────────────────────────
    await logAudit({
        userId,
        action: "generation.complete",
        targetType: "generation",
        targetId: generation.uid,
        metadata: {
            kind: "video",
            model: input.model,
            aspectRatio: input.aspectRatio,
            durationSeconds: input.durationSeconds,
            creditCost,
            sampleCount: input.sampleCount,
            videosGenerated: videoResults.length,
            projectUid: project.uid,
        },
        ip: requestIp,
    });

    return NextResponse.json({
        uid: generation.uid,
        status: "done",
        videoUrls: r2Keys.map(getImageUrl),
        creditCost,
    });
}
