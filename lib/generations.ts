/**
 * Generation CRUD — server-only.
 *
 * Manages the `generation` table lifecycle: create (pending), update
 * (done/failed), list (for dashboard + API).
 *
 * The generation row is the single source of truth for the lifecycle
 * of an image generation request. It's created BEFORE credits are
 * deducted so there's always a reference for refunds if the generation
 * fails.
 */

import { getDb } from "./db";
import { R2_KEY_PREFIX, R2_STORAGE_BASE_URL } from "./constants";
import { generateUid } from "./utils";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GenerationRow {
    id: number;
    uid: string;
    userId: string;
    model: string;
    prompt: string;
    negativePrompt: string | null;
    resolution: string;
    aspectRatio: string | null;
    sampleCount: number;
    status: "pending" | "done" | "failed";
    outputR2Keys: string[] | null;
    outputUrls: string[] | null;
    errorMessage: string | null;
    creditCost: number;
    createdAt: number;
    completedAt: number | null;
}

interface RawGenerationRow {
    id: number;
    uid: string;
    user_id: string;
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

function mapRow(r: RawGenerationRow): GenerationRow {
    const keys: string[] | null = r.output_r2_keys
        ? JSON.parse(r.output_r2_keys)
        : null;
    return {
        id: r.id,
        uid: r.uid,
        userId: r.user_id,
        model: r.model,
        prompt: r.prompt,
        negativePrompt: r.negative_prompt,
        resolution: r.resolution,
        aspectRatio: r.aspect_ratio,
        sampleCount: r.sample_count,
        status: r.status as GenerationRow["status"],
        outputR2Keys: keys,
        outputUrls: keys?.map((k) => `${R2_STORAGE_BASE_URL}/${k}`) ?? null,
        errorMessage: r.error_message,
        creditCost: r.credit_cost,
        createdAt: r.created_at,
        completedAt: r.completed_at,
    };
}

// ─── Create ─────────────────────────────────────────────────────────────────

export interface CreateGenerationParams {
    userId: string;
    model: string;
    prompt: string;
    negativePrompt?: string;
    resolution: string;
    aspectRatio?: string;
    sampleCount: number;
    creditCost: number;
    requestIp: string | null;
    userAgent: string | null;
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
             (uid, user_id, model, prompt, negative_prompt, resolution,
              aspect_ratio, sample_count, status, credit_cost,
              request_ip, user_agent, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
             RETURNING id`,
        )
        .bind(
            uid,
            params.userId,
            params.model,
            params.prompt,
            params.negativePrompt ?? null,
            params.resolution,
            params.aspectRatio ?? null,
            params.sampleCount,
            params.creditCost,
            params.requestIp,
            params.userAgent,
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
 * Returns a user's recent generations, newest first.
 */
export async function listGenerations(
    userId: string,
    limit = 20,
    offset = 0,
): Promise<GenerationRow[]> {
    const db = await getDb();
    const { results } = await db
        .prepare(
            `SELECT id, uid, user_id, model, prompt, negative_prompt,
                    resolution, aspect_ratio, sample_count, status,
                    output_r2_keys, error_message, credit_cost,
                    created_at, completed_at
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
            `SELECT id, uid, user_id, model, prompt, negative_prompt,
                    resolution, aspect_ratio, sample_count, status,
                    output_r2_keys, error_message, credit_cost,
                    created_at, completed_at
               FROM generation
              WHERE uid = ? AND user_id = ?
              LIMIT 1`,
        )
        .bind(uid, userId)
        .first<RawGenerationRow>();

    return row ? mapRow(row) : null;
}

// ─── R2 key helpers ─────────────────────────────────────────────────────────

/**
 * Builds the R2 object key for a generated image.
 * Format: film-maker/v1/generations/{userUid}/{generationUid}/{index}.{ext}
 */
export function buildR2Key(
    userUid: string,
    generationUid: string,
    index: number,
    mimeType: string,
): string {
    const ext = mimeType.includes("jpeg") || mimeType.includes("jpg")
        ? "jpg"
        : "png";
    return `${R2_KEY_PREFIX}/generations/${userUid}/${generationUid}/${index}.${ext}`;
}
