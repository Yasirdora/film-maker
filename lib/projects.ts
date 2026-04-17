/**
 * Project CRUD — server-only.
 *
 * Projects are the top-level container for a user's filmmaking work.
 * Every generation belongs to exactly one project. This scoping:
 *   • Keeps R2 storage organised: {user}/{project}/{image|video}/...
 *   • Gives users a natural way to group related work
 *   • Prepares the data model for v1 timelines, shots, and scenes
 *
 * Ownership is enforced at the query level — every read/write is
 * scoped to `user_id = ?` so a user can never access another user's
 * projects, even if they guess the UID.
 */

import { getDb } from "./db";
import { getImageUrl } from "./image-url";
import { generateUid } from "./utils";

// ─── Constants ─────────────────────────────────────────────────────────────

/** Maximum number of active (non-archived) projects per user. */
export const MAX_PROJECTS_PER_USER = 50;

/** Maximum project name length. */
export const MAX_PROJECT_NAME_LENGTH = 100;

/** Maximum project description length. */
export const MAX_PROJECT_DESCRIPTION_LENGTH = 500;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ProjectRow {
    id: number;
    uid: string;
    userId: string;
    name: string;
    description: string | null;
    coverGenerationId: number | null;
    pinnedAt: number | null;
    archivedAt: number | null;
    createdAt: number;
    updatedAt: number;
}

/** Lightweight projection for list views (no description). */
export interface ProjectSummary {
    uid: string;
    name: string;
    coverImageUrl: string | null;
    imageCount: number;
    videoCount: number;
    pinnedAt: number | null;
    createdAt: number;
    updatedAt: number;
}

interface RawProjectRow {
    id: number;
    uid: string;
    user_id: string;
    name: string;
    description: string | null;
    cover_generation_id: number | null;
    pinned_at: number | null;
    archived_at: number | null;
    created_at: number;
    updated_at: number;
}

interface RawProjectSummary {
    uid: string;
    name: string;
    cover_r2_key: string | null;
    image_count: number;
    video_count: number;
    pinned_at: number | null;
    created_at: number;
    updated_at: number;
}

function mapRow(r: RawProjectRow): ProjectRow {
    return {
        id: r.id,
        uid: r.uid,
        userId: r.user_id,
        name: r.name,
        description: r.description,
        coverGenerationId: r.cover_generation_id,
        pinnedAt: r.pinned_at,
        archivedAt: r.archived_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

function mapSummary(r: RawProjectSummary): ProjectSummary {
    return {
        uid: r.uid,
        name: r.name,
        coverImageUrl: r.cover_r2_key
            ? getImageUrl(r.cover_r2_key)
            : null,
        imageCount: r.image_count,
        videoCount: r.video_count,
        pinnedAt: r.pinned_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}


// ─── Create ────────────────────────────────────────────────────────────────

export interface CreateProjectParams {
    userId: string;
    name: string;
    description?: string;
}

/**
 * Creates a new project. Returns the project's `id` and `uid`.
 *
 * Enforces the per-user project cap to prevent abuse. Archived
 * projects do not count toward the limit.
 */
export async function createProject(
    params: CreateProjectParams,
): Promise<{ id: number; uid: string }> {
    const db = await getDb();

    // Enforce project cap (active projects only).
    const countRow = await db
        .prepare(
            "SELECT COUNT(*) as count FROM project WHERE user_id = ? AND archived_at IS NULL",
        )
        .bind(params.userId)
        .first<{ count: number }>();

    if ((countRow?.count ?? 0) >= MAX_PROJECTS_PER_USER) {
        throw new ProjectLimitError(
            `You can have at most ${MAX_PROJECTS_PER_USER} active projects. Archive some to create new ones.`,
        );
    }

    const uid = generateUid(16);
    const now = Date.now();

    const result = await db
        .prepare(
            `INSERT INTO project (uid, user_id, name, description, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             RETURNING id`,
        )
        .bind(uid, params.userId, params.name, params.description ?? null, now, now)
        .first<{ id: number }>();

    if (!result) {
        throw new Error("Failed to create project row");
    }

    return { id: result.id, uid };
}

// ─── Read ──────────────────────────────────────────────────────────────────

/**
 * Returns a single project by UID, scoped to the user.
 * Returns null if not found or if the project belongs to another user.
 */
export async function getProject(
    uid: string,
    userId: string,
): Promise<ProjectRow | null> {
    const db = await getDb();
    const row = await db
        .prepare(
            `SELECT id, uid, user_id, name, description, cover_generation_id,
                    pinned_at, archived_at, created_at, updated_at
               FROM project
              WHERE uid = ? AND user_id = ?
              LIMIT 1`,
        )
        .bind(uid, userId)
        .first<RawProjectRow>();

    return row ? mapRow(row) : null;
}

/**
 * Returns a single project by numeric ID, scoped to the user.
 * Used internally when we have the FK id (e.g. from generation.project_id).
 */
export async function getProjectById(
    id: number,
    userId: string,
): Promise<ProjectRow | null> {
    const db = await getDb();
    const row = await db
        .prepare(
            `SELECT id, uid, user_id, name, description, cover_generation_id,
                    pinned_at, archived_at, created_at, updated_at
               FROM project
              WHERE id = ? AND user_id = ?
              LIMIT 1`,
        )
        .bind(id, userId)
        .first<RawProjectRow>();

    return row ? mapRow(row) : null;
}

/**
 * Lists a user's active (non-archived) projects with summary stats.
 *
 * Includes the generation count and cover image URL (from the most
 * recent completed generation if no explicit cover is set). Ordered
 * by most recently updated first.
 */
export async function listProjects(
    userId: string,
): Promise<ProjectSummary[]> {
    const db = await getDb();
    const { results } = await db
        .prepare(
            `SELECT
                p.uid,
                p.name,
                p.pinned_at,
                p.created_at,
                p.updated_at,
                COUNT(CASE WHEN g.kind = 'image' THEN 1 END) as image_count,
                COUNT(CASE WHEN g.kind = 'video' THEN 1 END) as video_count,
                COALESCE(
                    -- Explicit cover: use the cover generation's first R2 key
                    (SELECT output_r2_keys FROM generation
                      WHERE id = p.cover_generation_id AND status = 'done'),
                    -- Prefer the most recent completed image generation
                    (SELECT output_r2_keys FROM generation
                      WHERE project_id = p.id AND status = 'done' AND kind = 'image'
                      ORDER BY created_at DESC LIMIT 1),
                    -- Fallback to the most recent completed generation of any kind
                    (SELECT output_r2_keys FROM generation
                      WHERE project_id = p.id AND status = 'done'
                      ORDER BY created_at DESC LIMIT 1)
                ) as cover_r2_key
             FROM project p
             LEFT JOIN generation g ON g.project_id = p.id
             WHERE p.user_id = ? AND p.archived_at IS NULL
             GROUP BY p.id
             -- Pinned first (most-recently-pinned on top), then fall
             -- back to regular recency for the unpinned tail.
             ORDER BY p.pinned_at IS NULL, p.pinned_at DESC, p.updated_at DESC`,
        )
        .bind(userId)
        .all<RawProjectSummary>();

    // cover_r2_key is a JSON array string — extract the first key.
    return results.map((r) => {
        let firstKey: string | null = null;
        if (r.cover_r2_key) {
            try {
                const keys = JSON.parse(r.cover_r2_key);
                firstKey = Array.isArray(keys) ? keys[0] ?? null : null;
            } catch {
                firstKey = null;
            }
        }
        return mapSummary({ ...r, cover_r2_key: firstKey });
    });
}

/**
 * Lists a user's archived projects. Same shape as listProjects but
 * filters for archived_at IS NOT NULL. Ordered by archive date (newest first).
 */
export async function listArchivedProjects(
    userId: string,
): Promise<ProjectSummary[]> {
    const db = await getDb();
    const { results } = await db
        .prepare(
            `SELECT
                p.uid,
                p.name,
                p.pinned_at,
                p.created_at,
                p.updated_at,
                COUNT(CASE WHEN g.kind = 'image' THEN 1 END) as image_count,
                COUNT(CASE WHEN g.kind = 'video' THEN 1 END) as video_count,
                COALESCE(
                    (SELECT output_r2_keys FROM generation
                      WHERE project_id = p.id AND status = 'done' AND kind = 'image'
                      ORDER BY created_at DESC LIMIT 1),
                    (SELECT output_r2_keys FROM generation
                      WHERE project_id = p.id AND status = 'done'
                      ORDER BY created_at DESC LIMIT 1)
                ) as cover_r2_key
             FROM project p
             LEFT JOIN generation g ON g.project_id = p.id
             WHERE p.user_id = ? AND p.archived_at IS NOT NULL
             GROUP BY p.id
             ORDER BY p.archived_at DESC`,
        )
        .bind(userId)
        .all<RawProjectSummary>();

    return results.map((r) => {
        let firstKey: string | null = null;
        if (r.cover_r2_key) {
            try {
                const keys = JSON.parse(r.cover_r2_key);
                firstKey = Array.isArray(keys) ? keys[0] ?? null : null;
            } catch {
                firstKey = null;
            }
        }
        return mapSummary({ ...r, cover_r2_key: firstKey });
    });
}

// ─── Update ────────────────────────────────────────────────────────────────

export interface UpdateProjectParams {
    name?: string;
    description?: string;
    coverGenerationId?: number | null;
}

/**
 * Updates a project's mutable fields. Only provided fields are changed.
 * Returns true if the row was updated, false if not found.
 */
export async function updateProject(
    uid: string,
    userId: string,
    params: UpdateProjectParams,
): Promise<boolean> {
    const db = await getDb();
    const sets: string[] = [];
    const values: (string | number | null)[] = [];

    if (params.name !== undefined) {
        sets.push("name = ?");
        values.push(params.name);
    }
    if (params.description !== undefined) {
        sets.push("description = ?");
        values.push(params.description);
    }
    if (params.coverGenerationId !== undefined) {
        sets.push("cover_generation_id = ?");
        values.push(params.coverGenerationId);
    }

    if (sets.length === 0) return false;

    sets.push("updated_at = ?");
    values.push(Date.now());
    values.push(uid, userId);

    const result = await db
        .prepare(
            `UPDATE project SET ${sets.join(", ")} WHERE uid = ? AND user_id = ?`,
        )
        .bind(...values)
        .run();

    return (result.meta?.changes ?? 0) > 0;
}

// ─── Pin / unpin ───────────────────────────────────────────────────────────

/**
 * Pins or unpins a project. Pinned projects float to the top of the
 * user's list.
 *
 * When pinning, `pinned_at` is set to the current timestamp so multiple
 * pinned projects sort by most-recently-pinned first (re-pinning an
 * already-pinned project bubbles it back to the top). When unpinning,
 * `pinned_at` is cleared.
 *
 * `updated_at` is deliberately NOT bumped here — pinning is an admin
 * action that shouldn't reorder the unpinned tail of the list.
 *
 * Returns true if the project was found (and therefore pinned/unpinned),
 * false if the uid doesn't belong to the user or the project is
 * archived.
 */
export async function pinProject(
    uid: string,
    userId: string,
    pinned: boolean,
): Promise<boolean> {
    const db = await getDb();
    const pinnedAt = pinned ? Date.now() : null;
    const result = await db
        .prepare(
            `UPDATE project SET pinned_at = ?
              WHERE uid = ? AND user_id = ? AND archived_at IS NULL`,
        )
        .bind(pinnedAt, uid, userId)
        .run();

    return (result.meta?.changes ?? 0) > 0;
}

// ─── Archive / restore ─────────────────────────────────────────────────────

/**
 * Soft-deletes a project by setting `archived_at`. Generations are
 * preserved (FK is SET NULL on project delete, but archiving keeps
 * everything intact for potential restore).
 */
export async function archiveProject(
    uid: string,
    userId: string,
): Promise<boolean> {
    const db = await getDb();
    const now = Date.now();
    const result = await db
        .prepare(
            `UPDATE project SET archived_at = ?, updated_at = ?
              WHERE uid = ? AND user_id = ? AND archived_at IS NULL`,
        )
        .bind(now, now, uid, userId)
        .run();

    return (result.meta?.changes ?? 0) > 0;
}

/**
 * Restores an archived project.
 */
export async function restoreProject(
    uid: string,
    userId: string,
): Promise<boolean> {
    const db = await getDb();
    const now = Date.now();
    const result = await db
        .prepare(
            `UPDATE project SET archived_at = NULL, updated_at = ?
              WHERE uid = ? AND user_id = ? AND archived_at IS NOT NULL`,
        )
        .bind(now, uid, userId)
        .run();

    return (result.meta?.changes ?? 0) > 0;
}

// ─── Error types ───────────────────────────────────────────────────────────

export class ProjectLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ProjectLimitError";
    }
}
