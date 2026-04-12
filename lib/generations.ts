/**
 * Generation CRUD — server-only.
 *
 * Manages the `generation` table lifecycle: create (pending), update
 * (done/failed), list (for dashboard + API).
 *
 * Every generation belongs to a project. The R2 key structure reflects
 * this ownership hierarchy:
 *
 *   film-maker/v1/{userUid}/{projectUid}/image/{generationUid}.{ext}
 *
 * The generation row is the single source of truth for the lifecycle
 * of an image generation request. It's created BEFORE credits are
 * deducted so there's always a reference for refunds if the generation
 * fails.
 */

import { getDb } from "./db";
import { getImageUrl } from "./image-url";
import { generateUid } from "./utils";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GenerationRow {
    id: number;
    uid: string;
    userId: string;
    projectId: number | null;
    model: string;
    prompt: string;
    negativePrompt: string | null;
    resolution: string;
    aspectRatio: string | null;
    sampleCount: number;
    status: "pending" | "done" | "failed";
    outputR2Keys: string[] | null;
    /** Preview-quality URLs (1024px, used in auteur canvas + detail views). */
    outputUrls: string[] | null;
    /** Thumbnail URLs (400px, used in gallery grids + project cards). */
    thumbnailUrls: string[] | null;
    /** Full-resolution URLs (original size, used for downloads). */
    downloadUrls: string[] | null;
    errorMessage: string | null;
    creditCost: number;
    createdAt: number;
    completedAt: number | null;
}

interface RawGenerationRow {
    id: number;
    uid: string;
    user_id: string;
    project_id: number | null;
    model: string;
    prompt: string;
    negative_prompt: string | null;
    resolution: string;
    aspect_ratio: string | null;
    sample_count: number;
    status: string;
    output_r2_keys: string | null;
    error_message: string | null;
    credit_cost: number;
    created_at: number;
    completed_at: number | null;
}

/** Column list used by all SELECT queries — single source of truth. */
const GENERATION_COLUMNS = `id, uid, user_id, project_id, model, prompt, negative_prompt,
    resolution, aspect_ratio, sample_count, status,
    output_r2_keys, error_message, credit_cost,
    created_at, completed_at`;

function mapRow(r: RawGenerationRow): GenerationRow {
    const keys: string[] | null = r.output_r2_keys
        ? JSON.parse(r.output_r2_keys)
        : null;
    return {
        id: r.id,
        uid: r.uid,
        userId: r.user_id,
        projectId: r.project_id,
        model: r.model,
        prompt: r.prompt,
        negativePrompt: r.negative_prompt,
        resolution: r.resolution,
        aspectRatio: r.aspect_ratio,
        sampleCount: r.sample_count,
        status: r.status as GenerationRow["status"],
        outputR2Keys: keys,
        outputUrls: keys?.map(getImageUrl) ?? null,
        thumbnailUrls: keys?.map(getImageUrl) ?? null,
        downloadUrls: keys?.map(getImageUrl) ?? null,
        errorMessage: r.error_message,
        creditCost: r.credit_cost,
        createdAt: r.created_at,
        completedAt: r.completed_at,
    };
}

// ─── Create ─────────────────────────────────────────────────────────────────

export interface CreateGenerationParams {
    userId: string;
    projectId: number;
    model: string;
    prompt: string;
    negativePrompt?: string;
    resolution: string;
    aspectRatio?: string;
    sampleCount: number;
    creditCost: number;
    requestIp: string | null;
    userAgent: string | null;
    idempotencyKey?: string;
}

/**
 * Creates a generation row in `pending` status. Returns the row's
 * `id` (for credit transaction FK) and `uid` (for client reference).
 */
export async function createGeneration(
    params: CreateGenerationParams,
): Promise<{ id: number; uid: string }> {
    const db = await getDb();
    const uid = generateUid(16);
    const now = Date.now();

    const result = await db
        .prepare(
            `INSERT INTO generation
             (uid, user_id, project_id, model, prompt, negative_prompt, resolution,
              aspect_ratio, sample_count, status, credit_cost,
              request_ip, user_agent, idempotency_key, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
             RETURNING id`,
        )
        .bind(
            uid,
            params.userId,
            params.projectId,
            params.model,
            params.prompt,
            params.negativePrompt ?? null,
            params.resolution,
            params.aspectRatio ?? null,
            params.sampleCount,
            params.creditCost,
            params.requestIp,
            params.userAgent,
            params.idempotencyKey ?? null,
            now,
            now,
        )
        .first<{ id: number }>();

    if (!result) {
        throw new Error("Failed to create generation row");
    }

    return { id: result.id, uid };
}

// ─── Update ─────────────────────────────────────────────────────────────────

/**
 * Marks a generation as successfully completed. Stores the R2 object
 * keys as a JSON array.
 */
export async function completeGeneration(
    generationId: number,
    r2Keys: string[],
): Promise<void> {
    const db = await getDb();
    const now = Date.now();

    await db
        .prepare(
            `UPDATE generation
                SET status = 'done',
                    output_r2_keys = ?,
                    completed_at = ?,
                    updated_at = ?
              WHERE id = ?`,
        )
        .bind(JSON.stringify(r2Keys), now, now, generationId)
        .run();
}

/**
 * Marks a generation as failed with an error message.
 */
export async function failGeneration(
    generationId: number,
    errorMessage: string,
): Promise<void> {
    const db = await getDb();
    const now = Date.now();

    await db
        .prepare(
            `UPDATE generation
                SET status = 'failed',
                    error_message = ?,
                    completed_at = ?,
                    updated_at = ?
              WHERE id = ?`,
        )
        .bind(errorMessage, now, now, generationId)
        .run();
}

// ─── Read ───────────────────────────────────────────────────────────────────

/**
 * Returns generations within a specific project, newest first.
 */
export async function listGenerationsByProject(
    projectId: number,
    userId: string,
    limit = 50,
    offset = 0,
): Promise<GenerationRow[]> {
    const db = await getDb();
    const { results } = await db
        .prepare(
            `SELECT ${GENERATION_COLUMNS}
               FROM generation
              WHERE project_id = ? AND user_id = ?
              ORDER BY created_at DESC
              LIMIT ? OFFSET ?`,
        )
        .bind(projectId, userId, limit, offset)
        .all<RawGenerationRow>();

    return results.map(mapRow);
}

/**
 * Returns a user's recent generations across all projects, newest first.
 * Used for the global activity feed / dashboard overview.
 */
export async function listGenerations(
    userId: string,
    limit = 20,
    offset = 0,
): Promise<GenerationRow[]> {
    const db = await getDb();
    const { results } = await db
        .prepare(
            `SELECT ${GENERATION_COLUMNS}
               FROM generation
              WHERE user_id = ?
              ORDER BY created_at DESC
              LIMIT ? OFFSET ?`,
        )
        .bind(userId, limit, offset)
        .all<RawGenerationRow>();

    return results.map(mapRow);
}

/**
 * Returns a single generation by UID, scoped to a user.
 */
export async function getGeneration(
    uid: string,
    userId: string,
): Promise<GenerationRow | null> {
    const db = await getDb();
    const row = await db
        .prepare(
            `SELECT ${GENERATION_COLUMNS}
               FROM generation
              WHERE uid = ? AND user_id = ?
              LIMIT 1`,
        )
        .bind(uid, userId)
        .first<RawGenerationRow>();

    return row ? mapRow(row) : null;
}

// ─── Idempotency ────────────────────────────────────────────────────────────

// Idempotency keys are valid for 24 hours (matching Stripe's design).
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Finds an existing generation by idempotency key, scoped to a user.
 * Returns null if no match or if the key has expired (>24h old).
 */
export async function findByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
): Promise<GenerationRow | null> {
    const db = await getDb();
    const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
    const row = await db
        .prepare(
            `SELECT ${GENERATION_COLUMNS}
               FROM generation
              WHERE user_id = ? AND idempotency_key = ? AND created_at > ?
              LIMIT 1`,
        )
        .bind(userId, idempotencyKey, cutoff)
        .first<RawGenerationRow>();

    return row ? mapRow(row) : null;
}

// ─── Concurrency control ────────────────────────────────────────────────────

/** Maximum concurrent pending generations per user. */
export const MAX_PENDING_PER_USER = 2;

/**
 * Returns the number of generations currently in "pending" status for
 * a user. Used to enforce concurrency limits.
 */
export async function countPendingGenerations(
    userId: string,
): Promise<number> {
    const db = await getDb();
    const row = await db
        .prepare(
            "SELECT COUNT(*) as count FROM generation WHERE user_id = ? AND status = 'pending'",
        )
        .bind(userId)
        .first<{ count: number }>();
    return row?.count ?? 0;
}

// ─── Stale generation recovery ──────────────────────────────────────────────

// Generations older than this in "pending" status are considered stale
// (Worker crashed or timed out before completing). Ported from ConveX's
// recoverStaleGenerations cron, adapted as lazy per-user recovery.
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Finds and marks stale "pending" generations for a specific user as
 * failed, refunding their credits. Called lazily at the start of each
 * generation request so orphaned records don't accumulate.
 *
 * Returns the number of recovered generations.
 */
export async function recoverStaleGenerations(
    userId: string,
): Promise<number> {
    const db = await getDb();
    const cutoff = Date.now() - STALE_THRESHOLD_MS;

    const { results } = await db
        .prepare(
            `SELECT id, credit_cost
               FROM generation
              WHERE user_id = ? AND status = 'pending' AND created_at < ?`,
        )
        .bind(userId, cutoff)
        .all<{ id: number; credit_cost: number }>();

    if (results.length === 0) return 0;

    // Lazy import to avoid circular dependency (credits → generations).
    const { refundCredits } = await import("./credits");

    for (const gen of results) {
        await failGeneration(gen.id, "Generation timed out. Please try again.");

        if (gen.credit_cost > 0) {
            // Refund to subscription pool by default — we don't know the
            // original pool split at this point, but subscription-first is
            // the safe default since it's the pool that expires.
            await refundCredits({
                userId,
                cost: gen.credit_cost,
                generationId: gen.id,
                deduction: {
                    fromSubscription: gen.credit_cost,
                    fromPurchased: 0,
                },
            });
        }
    }

    console.warn(
        `[generations] Recovered ${results.length} stale generation(s) for user ${userId}`,
    );

    return results.length;
}

// ─── R2 key helpers ─────────────────────────────────────────────────────────

/**
 * Builds the R2 object key for a generated asset.
 *
 * Structure:
 *   generation/{userUid}/{projectUid}/image/{generationUid}.{ext}
 *   generation/{userUid}/{projectUid}/video/{generationUid}.{ext}
 *
 * Produces clean public URLs:
 *   https://storage.film-maker.net/generation/{userUid}/{projectUid}/image/{generationUid}.webp
 *
 * Hierarchy: generation → user → project → content type → asset.
 * This grouping makes it straightforward to enumerate, migrate, or
 * delete all assets for a user or project via R2 prefix listing.
 */
export function buildR2Key(
    userUid: string,
    projectUid: string,
    contentType: "image" | "video",
    generationUid: string,
    mimeType: string,
): string {
    const ext = mimeType.includes("webp")
        ? "webp"
        : mimeType.includes("jpeg") || mimeType.includes("jpg")
            ? "jpg"
            : mimeType.includes("mp4")
                ? "mp4"
                : "png";
    return `generation/${userUid}/${projectUid}/${contentType}/${generationUid}.${ext}`;
}
