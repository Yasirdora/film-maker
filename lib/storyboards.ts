/**
 * Storyboard CRUD — server-only.
 *
 * Data layer for the pre-production storyboard surface. Hierarchy:
 *
 *     project ─── 1:N ─── storyboard ─── 1:N ─── scene ─── 1:N ─── shot
 *
 * Every read and write is scoped to `user_id = ?` so a user can never
 * touch another user's data, even with a guessed UID. The model is
 * intentionally narrow for Slice 1 (no AI fields wired up) — Slice 2
 * adds generation linkage + variant tables.
 *
 * Ordering invariants (enforced inside this module, never assumed by
 * callers):
 *
 *   • `position` is a dense integer sequence [0, 1, 2, …] within each
 *     parent. Reorders rewrite the affected slice in a single batch so
 *     two clients reordering concurrently can't desync into duplicate
 *     positions.
 *
 *   • Insertion appends — new scenes/shots go to the end. Drag-reorder
 *     is the only way to change order. Callers don't pick `position`.
 *
 * Throws `StoryboardNotFoundError` for missing/cross-tenant reads and
 * `StoryboardOwnershipError` for cross-tenant writes. Both extend
 * `Error` with stable `.name` so server actions can map them to clean
 * client messages without inspecting the prose.
 */

import { getDb } from "./db";
import { generateUid } from "./utils";

// ─── Errors ────────────────────────────────────────────────────────────────

export class StoryboardNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "StoryboardNotFoundError";
    }
}

export class StoryboardOwnershipError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "StoryboardOwnershipError";
    }
}

// ─── Vocabulary ────────────────────────────────────────────────────────────
//
// Canonical lists for the cinematography metadata stored on `shot`. Kept
// here (TypeScript) rather than in SQL CHECK constraints so the product
// can add values without a migration. The DB accepts any string; the UI
// and exporters render unknown values verbatim.

export const SHOT_TYPES = [
    "EXTREME_WIDE",
    "WIDE",
    "MEDIUM",
    "MEDIUM_CLOSE",
    "CLOSE",
    "EXTREME_CLOSE",
    "INSERT",
    "OVER_SHOULDER",
    "POV",
    "TWO_SHOT",
] as const;
export type ShotType = (typeof SHOT_TYPES)[number];

export const CAMERA_MOVES = [
    "STATIC",
    "PAN",
    "TILT",
    "DOLLY_IN",
    "DOLLY_OUT",
    "TRACK",
    "CRANE",
    "HANDHELD",
    "STEADICAM",
    "ZOOM_IN",
    "ZOOM_OUT",
] as const;
export type CameraMove = (typeof CAMERA_MOVES)[number];

export const TRANSITIONS = [
    "CUT",
    "DISSOLVE",
    "FADE_IN",
    "FADE_OUT",
    "WIPE",
    "MATCH_CUT",
    "SMASH_CUT",
    "J_CUT",
    "L_CUT",
] as const;
export type Transition = (typeof TRANSITIONS)[number];

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Storyboard {
    uid: string;
    projectId: number;
    title: string;
    createdAt: number;
    updatedAt: number;
}

export interface Scene {
    uid: string;
    storyboardUid: string;
    position: number;
    slugline: string | null;
    action: string | null;
    notes: string | null;
    createdAt: number;
    updatedAt: number;
    shots: Shot[];
}

export interface Shot {
    uid: string;
    sceneUid: string;
    position: number;
    prompt: string | null;
    action: string | null;
    dialogue: string | null;
    durationMs: number;
    notes: string | null;
    shotType: string | null;
    cameraMove: string | null;
    transition: string | null;
    createdAt: number;
    updatedAt: number;
    /** Selected image's R2 key, or null when the shot has no image yet.
     *  The full variants list isn't eagerly loaded — it's fetched on
     *  demand when the user opens the variant tray. */
    selectedImage: ShotImageSummary | null;
    /** Total number of images attached to this shot (selected + alts).
     *  Drives the small "+N" badge on the card. */
    imageCount: number;
}

export type ShotImageSource = "upload" | "generation";

/** Trimmed shape for board-list queries — enough to render the card. */
export interface ShotImageSummary {
    uid: string;
    r2Key: string;
    width: number;
    height: number;
    source: ShotImageSource;
}

/** Full shape for the variant tray. */
export interface ShotImage extends ShotImageSummary {
    shotUid: string;
    uploadBytes: number | null;
    uploadOriginMime: string | null;
    generationId: number | null;
    variantIndex: number | null;
    isSelected: boolean;
    createdAt: number;
}

/** Full eager-loaded shape used by the workspace page. */
export interface StoryboardBoard {
    storyboard: Storyboard;
    scenes: Scene[];
}

// ─── Internal row shapes ───────────────────────────────────────────────────

interface RawStoryboard {
    id: number;
    uid: string;
    project_id: number;
    title: string;
    created_at: number;
    updated_at: number;
}

interface RawScene {
    id: number;
    uid: string;
    storyboard_id: number;
    position: number;
    slugline: string | null;
    action: string | null;
    notes: string | null;
    created_at: number;
    updated_at: number;
}

interface RawShot {
    id: number;
    uid: string;
    scene_id: number;
    position: number;
    prompt: string | null;
    action: string | null;
    dialogue: string | null;
    duration_ms: number;
    notes: string | null;
    shot_type: string | null;
    camera_move: string | null;
    transition: string | null;
    created_at: number;
    updated_at: number;
    /** Joined from a LEFT JOIN on storyboard_shot_image WHERE is_selected = 1.
     *  Null when the shot has no image yet. */
    sel_image_uid?: string | null;
    sel_image_r2_key?: string | null;
    sel_image_width?: number | null;
    sel_image_height?: number | null;
    sel_image_source?: ShotImageSource | null;
    image_count?: number;
}

interface RawShotImage {
    id: number;
    uid: string;
    shot_id: number;
    source: ShotImageSource;
    r2_key: string;
    width: number;
    height: number;
    upload_bytes: number | null;
    upload_origin_mime: string | null;
    generation_id: number | null;
    variant_index: number | null;
    is_selected: number;
    created_at: number;
}

// ─── Mappers ───────────────────────────────────────────────────────────────

function mapStoryboard(r: RawStoryboard): Storyboard {
    return {
        uid: r.uid,
        projectId: r.project_id,
        title: r.title,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

function mapShot(r: RawShot, sceneUid: string): Shot {
    const selectedImage: ShotImageSummary | null =
        r.sel_image_uid && r.sel_image_r2_key && r.sel_image_source
            ? {
                  uid: r.sel_image_uid,
                  r2Key: r.sel_image_r2_key,
                  width: r.sel_image_width ?? 0,
                  height: r.sel_image_height ?? 0,
                  source: r.sel_image_source,
              }
            : null;

    return {
        uid: r.uid,
        sceneUid,
        position: r.position,
        prompt: r.prompt,
        action: r.action,
        dialogue: r.dialogue,
        durationMs: r.duration_ms,
        notes: r.notes,
        shotType: r.shot_type,
        cameraMove: r.camera_move,
        transition: r.transition,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        selectedImage,
        imageCount: r.image_count ?? 0,
    };
}

function mapShotImage(r: RawShotImage, shotUid: string): ShotImage {
    return {
        uid: r.uid,
        shotUid,
        r2Key: r.r2_key,
        width: r.width,
        height: r.height,
        source: r.source,
        uploadBytes: r.upload_bytes,
        uploadOriginMime: r.upload_origin_mime,
        generationId: r.generation_id,
        variantIndex: r.variant_index,
        isSelected: r.is_selected === 1,
        createdAt: r.created_at,
    };
}

function mapScene(r: RawScene, storyboardUid: string, shots: Shot[]): Scene {
    return {
        uid: r.uid,
        storyboardUid,
        position: r.position,
        slugline: r.slugline,
        action: r.action,
        notes: r.notes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        shots,
    };
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Resolves a project UID to its numeric id + owner, or throws. Used as
 * the entry-guard for every write — confirming ownership *before* we
 * touch storyboard tables means we never leak cross-tenant data even
 * if a malicious payload includes a valid storyboard UID belonging to
 * someone else.
 */
async function requireProject(
    projectUid: string,
    userId: string,
): Promise<{ id: number }> {
    const db = await getDb();
    const row = await db
        .prepare(
            "SELECT id FROM project WHERE uid = ? AND user_id = ? LIMIT 1",
        )
        .bind(projectUid, userId)
        .first<{ id: number }>();
    if (!row) {
        throw new StoryboardNotFoundError("Project not found");
    }
    return row;
}

/**
 * Returns the numeric id of a storyboard scoped to the user, or throws.
 * Used by mutation guards.
 */
async function requireStoryboardId(
    storyboardUid: string,
    userId: string,
): Promise<number> {
    const db = await getDb();
    const row = await db
        .prepare(
            "SELECT id FROM storyboard WHERE uid = ? AND user_id = ? LIMIT 1",
        )
        .bind(storyboardUid, userId)
        .first<{ id: number }>();
    if (!row) {
        throw new StoryboardNotFoundError("Storyboard not found");
    }
    return row.id;
}

/**
 * Returns a scene + the id of the storyboard it belongs to, scoped to
 * the user. Throws if missing or cross-tenant. Used so shot-level writes
 * can confirm the path scene → storyboard → user in a single trip.
 */
async function requireSceneId(
    sceneUid: string,
    userId: string,
): Promise<{ id: number; storyboardId: number }> {
    const db = await getDb();
    const row = await db
        .prepare(
            `SELECT s.id AS scene_id, s.storyboard_id AS storyboard_id
               FROM storyboard_scene s
               JOIN storyboard b ON b.id = s.storyboard_id
              WHERE s.uid = ? AND b.user_id = ?
              LIMIT 1`,
        )
        .bind(sceneUid, userId)
        .first<{ scene_id: number; storyboard_id: number }>();
    if (!row) {
        throw new StoryboardNotFoundError("Scene not found");
    }
    return { id: row.scene_id, storyboardId: row.storyboard_id };
}

/**
 * Returns a shot's id + its containing scene + its storyboard, scoped
 * to the user. Throws if missing or cross-tenant.
 */
async function requireShotId(
    shotUid: string,
    userId: string,
): Promise<{ id: number; sceneId: number; storyboardId: number }> {
    const db = await getDb();
    const row = await db
        .prepare(
            `SELECT sh.id AS shot_id,
                    sh.scene_id AS scene_id,
                    sc.storyboard_id AS storyboard_id
               FROM storyboard_shot sh
               JOIN storyboard_scene sc ON sc.id = sh.scene_id
               JOIN storyboard b ON b.id = sc.storyboard_id
              WHERE sh.uid = ? AND b.user_id = ?
              LIMIT 1`,
        )
        .bind(shotUid, userId)
        .first<{ shot_id: number; scene_id: number; storyboard_id: number }>();
    if (!row) {
        throw new StoryboardNotFoundError("Shot not found");
    }
    return {
        id: row.shot_id,
        sceneId: row.scene_id,
        storyboardId: row.storyboard_id,
    };
}

/** Bumps `updated_at` on a storyboard so list queries can sort by recency. */
async function touchStoryboard(storyboardId: number): Promise<void> {
    const db = await getDb();
    await db
        .prepare("UPDATE storyboard SET updated_at = ? WHERE id = ?")
        .bind(Date.now(), storyboardId)
        .run();
}

// ─── Read ──────────────────────────────────────────────────────────────────

/**
 * Returns the project's storyboard with all scenes + shots, creating an
 * empty one on first access. The "lazy create" pattern keeps the project
 * row pristine until the user actually opens the storyboard surface —
 * we don't want every newly-created project to carry an empty board.
 *
 * Returns the board in display order: scenes ascending by position, shots
 * ascending by position within each scene.
 */
export async function getOrCreateStoryboard(
    projectUid: string,
    userId: string,
): Promise<StoryboardBoard> {
    const project = await requireProject(projectUid, userId);
    const db = await getDb();

    // Pick the most recently updated board, or create one if none exist.
    // The schema allows multiple boards per project (director's cut +
    // alternates), but Slice 1 only ever surfaces the latest.
    let board = await db
        .prepare(
            `SELECT id, uid, project_id, title, created_at, updated_at
               FROM storyboard
              WHERE project_id = ?
              ORDER BY updated_at DESC
              LIMIT 1`,
        )
        .bind(project.id)
        .first<RawStoryboard>();

    if (!board) {
        const uid = generateUid(16);
        const now = Date.now();
        const created = await db
            .prepare(
                `INSERT INTO storyboard
                   (uid, project_id, user_id, title, created_at, updated_at)
                 VALUES (?, ?, ?, 'Storyboard', ?, ?)
                 RETURNING id, uid, project_id, title, created_at, updated_at`,
            )
            .bind(uid, project.id, userId, now, now)
            .first<RawStoryboard>();
        if (!created) {
            throw new Error("Failed to create storyboard row");
        }
        board = created;
    }

    const storyboardUid = board.uid;
    const storyboard = mapStoryboard(board);

    // Two flat queries + an in-memory join — cheaper than N+1 joins and
    // simpler than a single multi-result query, given D1's lack of
    // server-side multi-statement RETURNING.
    const { results: sceneRows } = await db
        .prepare(
            `SELECT id, uid, storyboard_id, position, slugline, action, notes,
                    created_at, updated_at
               FROM storyboard_scene
              WHERE storyboard_id = ?
              ORDER BY position ASC, id ASC`,
        )
        .bind(board.id)
        .all<RawScene>();

    if (sceneRows.length === 0) {
        return { storyboard, scenes: [] };
    }

    const sceneIds = sceneRows.map((r) => r.id);
    // `IN (?, ?, …)` — D1 doesn't expose array binding, so we expand.
    // Cap is high enough not to matter in practice (50 projects × N scenes
    // each is well under SQLite's parameter limit of 999).
    const placeholders = sceneIds.map(() => "?").join(", ");
    // Eager-load the selected image + total image count per shot.
    // Two scalar subqueries instead of a join keeps the row shape flat
    // and avoids fan-out when a shot has many images (we only want the
    // selected one for board render).
    const { results: shotRows } = await db
        .prepare(
            `SELECT sh.id, sh.uid, sh.scene_id, sh.position, sh.prompt, sh.action,
                    sh.dialogue, sh.duration_ms, sh.notes, sh.shot_type,
                    sh.camera_move, sh.transition, sh.created_at, sh.updated_at,
                    (SELECT uid    FROM storyboard_shot_image
                      WHERE shot_id = sh.id AND is_selected = 1) AS sel_image_uid,
                    (SELECT r2_key FROM storyboard_shot_image
                      WHERE shot_id = sh.id AND is_selected = 1) AS sel_image_r2_key,
                    (SELECT width  FROM storyboard_shot_image
                      WHERE shot_id = sh.id AND is_selected = 1) AS sel_image_width,
                    (SELECT height FROM storyboard_shot_image
                      WHERE shot_id = sh.id AND is_selected = 1) AS sel_image_height,
                    (SELECT source FROM storyboard_shot_image
                      WHERE shot_id = sh.id AND is_selected = 1) AS sel_image_source,
                    (SELECT COUNT(*) FROM storyboard_shot_image
                      WHERE shot_id = sh.id) AS image_count
               FROM storyboard_shot sh
              WHERE sh.scene_id IN (${placeholders})
              ORDER BY sh.position ASC, sh.id ASC`,
        )
        .bind(...sceneIds)
        .all<RawShot>();

    // Bucket shots by scene_id → scene.uid map for the mapping pass.
    const sceneUidById = new Map<number, string>();
    const shotsBySceneId = new Map<number, Shot[]>();
    for (const r of sceneRows) {
        sceneUidById.set(r.id, r.uid);
        shotsBySceneId.set(r.id, []);
    }
    for (const r of shotRows) {
        const uid = sceneUidById.get(r.scene_id);
        if (!uid) continue;
        shotsBySceneId.get(r.scene_id)?.push(mapShot(r, uid));
    }

    const scenes = sceneRows.map((r) =>
        mapScene(r, storyboardUid, shotsBySceneId.get(r.id) ?? []),
    );

    return { storyboard, scenes };
}

// ─── Storyboard-level writes ───────────────────────────────────────────────

export async function renameStoryboard(
    storyboardUid: string,
    userId: string,
    title: string,
): Promise<void> {
    const id = await requireStoryboardId(storyboardUid, userId);
    const trimmed = title.trim();
    if (trimmed.length === 0) {
        throw new Error("Title cannot be empty");
    }
    if (trimmed.length > 200) {
        throw new Error("Title is too long");
    }
    const db = await getDb();
    await db
        .prepare("UPDATE storyboard SET title = ?, updated_at = ? WHERE id = ?")
        .bind(trimmed, Date.now(), id)
        .run();
}

// ─── Scene writes ──────────────────────────────────────────────────────────

/**
 * Appends a new scene at the end of the storyboard. Returns the created
 * scene shape so the client can render optimistically without a refetch.
 */
export async function addScene(
    storyboardUid: string,
    userId: string,
): Promise<Scene> {
    const storyboardId = await requireStoryboardId(storyboardUid, userId);
    const db = await getDb();

    // Append: position = max(existing) + 1, or 0 if empty.
    const max = await db
        .prepare(
            "SELECT MAX(position) AS max_pos FROM storyboard_scene WHERE storyboard_id = ?",
        )
        .bind(storyboardId)
        .first<{ max_pos: number | null }>();
    const position = (max?.max_pos ?? -1) + 1;

    const uid = generateUid(16);
    const now = Date.now();
    const created = await db
        .prepare(
            `INSERT INTO storyboard_scene
               (uid, storyboard_id, position, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)
             RETURNING id, uid, storyboard_id, position, slugline, action, notes,
                       created_at, updated_at`,
        )
        .bind(uid, storyboardId, position, now, now)
        .first<RawScene>();
    if (!created) {
        throw new Error("Failed to create scene row");
    }
    await touchStoryboard(storyboardId);
    return mapScene(created, storyboardUid, []);
}

export interface UpdateSceneInput {
    slugline?: string | null;
    action?: string | null;
    notes?: string | null;
}

export async function updateScene(
    sceneUid: string,
    userId: string,
    input: UpdateSceneInput,
): Promise<void> {
    const { id, storyboardId } = await requireSceneId(sceneUid, userId);

    const fields: string[] = [];
    const values: (string | null | number)[] = [];
    if ("slugline" in input) {
        fields.push("slugline = ?");
        values.push(input.slugline ?? null);
    }
    if ("action" in input) {
        fields.push("action = ?");
        values.push(input.action ?? null);
    }
    if ("notes" in input) {
        fields.push("notes = ?");
        values.push(input.notes ?? null);
    }
    if (fields.length === 0) return;

    fields.push("updated_at = ?");
    values.push(Date.now());
    values.push(id);

    const db = await getDb();
    await db
        .prepare(
            `UPDATE storyboard_scene SET ${fields.join(", ")} WHERE id = ?`,
        )
        .bind(...values)
        .run();

    await touchStoryboard(storyboardId);
}

export async function deleteScene(
    sceneUid: string,
    userId: string,
): Promise<void> {
    const { id, storyboardId } = await requireSceneId(sceneUid, userId);
    const db = await getDb();

    // Read position *before* delete so the gap-close UPDATE below can
    // target only the suffix. ON DELETE CASCADE handles shots.
    const row = await db
        .prepare(
            "SELECT position, storyboard_id FROM storyboard_scene WHERE id = ?",
        )
        .bind(id)
        .first<{ position: number; storyboard_id: number }>();
    if (!row) return;

    await db.prepare("DELETE FROM storyboard_scene WHERE id = ?").bind(id).run();

    // Close the gap so subsequent inserts stay dense.
    await db
        .prepare(
            `UPDATE storyboard_scene
                SET position = position - 1, updated_at = ?
              WHERE storyboard_id = ? AND position > ?`,
        )
        .bind(Date.now(), row.storyboard_id, row.position)
        .run();

    await touchStoryboard(storyboardId);
}

/**
 * Rewrites scene positions in batch. `orderedSceneUids` is the full set
 * of scenes in the new order — partial reorders are not supported. Any
 * UID not currently in the storyboard is silently ignored so a stale
 * client (e.g. one that missed a delete) doesn't desync the board.
 */
export async function reorderScenes(
    storyboardUid: string,
    userId: string,
    orderedSceneUids: string[],
): Promise<void> {
    const storyboardId = await requireStoryboardId(storyboardUid, userId);
    const db = await getDb();

    // Fetch authoritative set so we can ignore stale UIDs.
    const { results } = await db
        .prepare("SELECT id, uid FROM storyboard_scene WHERE storyboard_id = ?")
        .bind(storyboardId)
        .all<{ id: number; uid: string }>();
    const idByUid = new Map(results.map((r) => [r.uid, r.id]));

    const now = Date.now();
    const stmts = orderedSceneUids
        .map((uid, position) => {
            const id = idByUid.get(uid);
            if (id === undefined) return null;
            return db
                .prepare(
                    "UPDATE storyboard_scene SET position = ?, updated_at = ? WHERE id = ?",
                )
                .bind(position, now, id);
        })
        .filter(<T,>(x: T | null): x is T => x !== null);

    if (stmts.length === 0) return;
    await db.batch(stmts);
    await touchStoryboard(storyboardId);
}

// ─── Shot writes ───────────────────────────────────────────────────────────

export async function addShot(
    sceneUid: string,
    userId: string,
): Promise<Shot> {
    const { id: sceneId, storyboardId } = await requireSceneId(sceneUid, userId);
    const db = await getDb();

    const max = await db
        .prepare(
            "SELECT MAX(position) AS max_pos FROM storyboard_shot WHERE scene_id = ?",
        )
        .bind(sceneId)
        .first<{ max_pos: number | null }>();
    const position = (max?.max_pos ?? -1) + 1;

    const uid = generateUid(16);
    const now = Date.now();
    const created = await db
        .prepare(
            `INSERT INTO storyboard_shot
               (uid, scene_id, position, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)
             RETURNING id, uid, scene_id, position, prompt, action, dialogue,
                       duration_ms, notes, shot_type, camera_move, transition,
                       created_at, updated_at`,
        )
        .bind(uid, sceneId, position, now, now)
        .first<RawShot>();
    if (!created) {
        throw new Error("Failed to create shot row");
    }
    await touchStoryboard(storyboardId);
    // Brand-new shot — no images yet. The mapper handles the null/0
    // defaults via the optional fields on RawShot.
    return mapShot(created, sceneUid);
}

export interface UpdateShotInput {
    prompt?: string | null;
    action?: string | null;
    dialogue?: string | null;
    durationMs?: number;
    notes?: string | null;
    shotType?: string | null;
    cameraMove?: string | null;
    transition?: string | null;
}

export async function updateShot(
    shotUid: string,
    userId: string,
    input: UpdateShotInput,
): Promise<void> {
    const { id, storyboardId } = await requireShotId(shotUid, userId);

    const fields: string[] = [];
    const values: (string | null | number)[] = [];
    const setStr = (col: string, v: string | null | undefined) => {
        if (v === undefined) return;
        fields.push(`${col} = ?`);
        values.push(v ?? null);
    };

    setStr("prompt", input.prompt);
    setStr("action", input.action);
    setStr("dialogue", input.dialogue);
    setStr("notes", input.notes);
    setStr("shot_type", input.shotType);
    setStr("camera_move", input.cameraMove);
    setStr("transition", input.transition);

    if (input.durationMs !== undefined) {
        if (input.durationMs < 0 || !Number.isFinite(input.durationMs)) {
            throw new Error("Duration must be a non-negative number");
        }
        fields.push("duration_ms = ?");
        values.push(Math.round(input.durationMs));
    }

    if (fields.length === 0) return;

    fields.push("updated_at = ?");
    values.push(Date.now());
    values.push(id);

    const db = await getDb();
    await db
        .prepare(`UPDATE storyboard_shot SET ${fields.join(", ")} WHERE id = ?`)
        .bind(...values)
        .run();

    await touchStoryboard(storyboardId);
}

export async function deleteShot(
    shotUid: string,
    userId: string,
): Promise<void> {
    const { id, storyboardId } = await requireShotId(shotUid, userId);
    const db = await getDb();

    const row = await db
        .prepare("SELECT position, scene_id FROM storyboard_shot WHERE id = ?")
        .bind(id)
        .first<{ position: number; scene_id: number }>();
    if (!row) return;

    await db.prepare("DELETE FROM storyboard_shot WHERE id = ?").bind(id).run();

    await db
        .prepare(
            `UPDATE storyboard_shot
                SET position = position - 1, updated_at = ?
              WHERE scene_id = ? AND position > ?`,
        )
        .bind(Date.now(), row.scene_id, row.position)
        .run();

    await touchStoryboard(storyboardId);
}

/**
 * Reorders shots — supports moves within a scene OR across scenes in a
 * single call. `targetSceneUid` is the destination; `orderedShotUids` is
 * the destination's full new order. Any shot UID not currently owned by
 * the user is silently dropped (defends against stale client state).
 *
 * When a shot moves across scenes, the source scene's positions are
 * automatically tightened (gap closed). Single transaction.
 */
export async function reorderShots(
    targetSceneUid: string,
    userId: string,
    orderedShotUids: string[],
): Promise<void> {
    const { id: targetSceneId, storyboardId } = await requireSceneId(
        targetSceneUid,
        userId,
    );
    const db = await getDb();

    // Pull current shot rows owned by this user from the union of:
    //   (a) the target scene's current shots, and
    //   (b) any shot in the supplied list.
    // We need (a) so that shots not in the new ordering stay safely in
    // place if a client sends a partial list — but for correctness we
    // require the full target ordering, so (b) is mostly for cross-scene
    // moves.
    if (orderedShotUids.length === 0) {
        // Caller meant "empty the target scene of these shots" — but we
        // never accept that as a no-op: an empty new ordering is a bug
        // in the caller. Better to fail loud than silently lose data.
        throw new Error("Empty shot ordering");
    }

    const placeholders = orderedShotUids.map(() => "?").join(", ");
    const { results } = await db
        .prepare(
            `SELECT sh.id, sh.uid, sh.scene_id
               FROM storyboard_shot sh
               JOIN storyboard_scene sc ON sc.id = sh.scene_id
               JOIN storyboard b ON b.id = sc.storyboard_id
              WHERE b.user_id = ? AND sh.uid IN (${placeholders})`,
        )
        .bind(userId, ...orderedShotUids)
        .all<{ id: number; uid: string; scene_id: number }>();

    const rowByUid = new Map(results.map((r) => [r.uid, r]));
    const now = Date.now();

    // Track source scenes so we can compact them afterwards.
    const affectedSourceScenes = new Set<number>();
    for (const r of results) {
        if (r.scene_id !== targetSceneId) {
            affectedSourceScenes.add(r.scene_id);
        }
    }

    const stmts = orderedShotUids
        .map((uid, position) => {
            const r = rowByUid.get(uid);
            if (!r) return null;
            return db
                .prepare(
                    `UPDATE storyboard_shot
                        SET scene_id = ?, position = ?, updated_at = ?
                      WHERE id = ?`,
                )
                .bind(targetSceneId, position, now, r.id);
        })
        .filter(<T,>(x: T | null): x is T => x !== null);

    if (stmts.length > 0) {
        await db.batch(stmts);
    }

    // Compact source scenes — after the cross-scene moves above, source
    // scenes might have gaps. Rewrite their positions to a dense
    // sequence in row order.
    for (const sceneId of affectedSourceScenes) {
        const { results: remaining } = await db
            .prepare(
                "SELECT id FROM storyboard_shot WHERE scene_id = ? ORDER BY position ASC, id ASC",
            )
            .bind(sceneId)
            .all<{ id: number }>();
        const compactStmts = remaining.map((r, i) =>
            db
                .prepare(
                    "UPDATE storyboard_shot SET position = ?, updated_at = ? WHERE id = ?",
                )
                .bind(i, now, r.id),
        );
        if (compactStmts.length > 0) {
            await db.batch(compactStmts);
        }
    }

    await touchStoryboard(storyboardId);
}

// ─── Shot images ───────────────────────────────────────────────────────────

/**
 * Returns every image attached to a shot, most-recent first. Used by
 * the variant tray. Does NOT eagerly include R2 contents — the client
 * follows up with image URL fetches.
 */
export async function getShotImages(
    shotUid: string,
    userId: string,
): Promise<ShotImage[]> {
    await requireShotId(shotUid, userId);
    const db = await getDb();
    const { results } = await db
        .prepare(
            `SELECT si.id, si.uid, si.shot_id, si.source, si.r2_key, si.width,
                    si.height, si.upload_bytes, si.upload_origin_mime,
                    si.generation_id, si.variant_index, si.is_selected,
                    si.created_at
               FROM storyboard_shot_image si
               JOIN storyboard_shot sh ON sh.id = si.shot_id
              WHERE sh.uid = ?
              ORDER BY si.created_at DESC, si.id DESC`,
        )
        .bind(shotUid)
        .all<RawShotImage>();
    return results.map((r) => mapShotImage(r, shotUid));
}

/**
 * Resolves an image's owner-scoped identity + the shot it belongs to.
 * Used by mutation guards (delete, select).
 */
async function requireShotImageId(
    imageUid: string,
    userId: string,
): Promise<{
    id: number;
    r2Key: string;
    shotId: number;
    storyboardId: number;
}> {
    const db = await getDb();
    const row = await db
        .prepare(
            `SELECT si.id AS image_id,
                    si.r2_key AS r2_key,
                    sh.id AS shot_id,
                    sc.storyboard_id AS storyboard_id
               FROM storyboard_shot_image si
               JOIN storyboard_shot sh ON sh.id = si.shot_id
               JOIN storyboard_scene sc ON sc.id = sh.scene_id
               JOIN storyboard b ON b.id = sc.storyboard_id
              WHERE si.uid = ? AND b.user_id = ?
              LIMIT 1`,
        )
        .bind(imageUid, userId)
        .first<{
            image_id: number;
            r2_key: string;
            shot_id: number;
            storyboard_id: number;
        }>();
    if (!row) {
        throw new StoryboardNotFoundError("Image not found");
    }
    return {
        id: row.image_id,
        r2Key: row.r2_key,
        shotId: row.shot_id,
        storyboardId: row.storyboard_id,
    };
}

export interface CreateUploadedImageParams {
    shotUid: string;
    userId: string;
    /** Pre-generated row UID. Must match the `{imageUid}` fragment in
     *  `r2Key` so ops can grep a key back to its row in one step. The
     *  caller generates this so it can build the R2 key *before* the
     *  upload happens (the R2 put precedes the DB insert). */
    imageUid: string;
    r2Key: string;
    width: number;
    height: number;
    bytes: number;
    originMime: string;
}

/**
 * Inserts a row for a user-uploaded image. The caller is responsible
 * for having already written the bytes to R2 at `r2Key`; on first
 * upload to a shot the new image is auto-selected, otherwise it lands
 * as an unselected alternate (user picks via the variant tray).
 *
 * Returns the full row so the client can append it to its local cache
 * without a refetch.
 */
export async function createUploadedImage(
    params: CreateUploadedImageParams,
): Promise<ShotImage> {
    const { id: shotId, storyboardId } = await requireShotId(
        params.shotUid,
        params.userId,
    );
    const db = await getDb();

    // Auto-select if this is the shot's first image.
    const existing = await db
        .prepare("SELECT COUNT(*) AS c FROM storyboard_shot_image WHERE shot_id = ?")
        .bind(shotId)
        .first<{ c: number }>();
    const isSelected = (existing?.c ?? 0) === 0 ? 1 : 0;

    const now = Date.now();
    const created = await db
        .prepare(
            `INSERT INTO storyboard_shot_image
               (uid, shot_id, source, r2_key, width, height, upload_bytes,
                upload_origin_mime, is_selected, created_at)
             VALUES (?, ?, 'upload', ?, ?, ?, ?, ?, ?, ?)
             RETURNING id, uid, shot_id, source, r2_key, width, height,
                       upload_bytes, upload_origin_mime, generation_id,
                       variant_index, is_selected, created_at`,
        )
        .bind(
            params.imageUid,
            shotId,
            params.r2Key,
            params.width,
            params.height,
            params.bytes,
            params.originMime,
            isSelected,
            now,
        )
        .first<RawShotImage>();
    if (!created) {
        throw new Error("Failed to create shot_image row");
    }

    await touchStoryboard(storyboardId);
    return mapShotImage(created, params.shotUid);
}

/**
 * Marks a single image as selected for its shot, atomically clearing
 * the previous selection. The unique partial index in the schema makes
 * "clear then set" safe under concurrent edits — a second writer's
 * INSERT-style update would fail loud rather than silently land two
 * selected rows.
 */
export async function selectShotImage(
    imageUid: string,
    userId: string,
): Promise<void> {
    const { id: imageId, shotId, storyboardId } = await requireShotImageId(
        imageUid,
        userId,
    );
    const db = await getDb();
    await db.batch([
        db
            .prepare(
                "UPDATE storyboard_shot_image SET is_selected = 0 WHERE shot_id = ? AND is_selected = 1",
            )
            .bind(shotId),
        db
            .prepare(
                "UPDATE storyboard_shot_image SET is_selected = 1 WHERE id = ?",
            )
            .bind(imageId),
    ]);
    await touchStoryboard(storyboardId);
}

/**
 * Removes an image (DB row + R2 object). If the deleted image was
 * currently selected, the most recent remaining image is promoted so
 * the shot card doesn't blink back to its empty state on delete.
 *
 * Returns the new selection's UID (or null if the shot is now empty)
 * so the client can sync optimistically without a refetch.
 */
export async function deleteShotImage(
    imageUid: string,
    userId: string,
): Promise<{ newSelectedUid: string | null }> {
    const { id: imageId, r2Key, shotId, storyboardId } =
        await requireShotImageId(imageUid, userId);
    const db = await getDb();

    const row = await db
        .prepare(
            "SELECT is_selected FROM storyboard_shot_image WHERE id = ?",
        )
        .bind(imageId)
        .first<{ is_selected: number }>();
    const wasSelected = (row?.is_selected ?? 0) === 1;

    await db
        .prepare("DELETE FROM storyboard_shot_image WHERE id = ?")
        .bind(imageId)
        .run();

    // Delete the R2 object — best-effort. If R2 fails the object is
    // orphaned but the user's view is consistent; periodic cleanup
    // sweeps unreferenced keys.
    try {
        const { getR2 } = await import("./db");
        const r2 = await getR2();
        await r2.delete(r2Key);
    } catch (err) {
        console.warn("[storyboards] R2 delete failed", r2Key, err);
    }

    let newSelectedUid: string | null = null;
    if (wasSelected) {
        const next = await db
            .prepare(
                `SELECT id, uid FROM storyboard_shot_image
                  WHERE shot_id = ?
                  ORDER BY created_at DESC, id DESC
                  LIMIT 1`,
            )
            .bind(shotId)
            .first<{ id: number; uid: string }>();
        if (next) {
            await db
                .prepare(
                    "UPDATE storyboard_shot_image SET is_selected = 1 WHERE id = ?",
                )
                .bind(next.id)
                .run();
            newSelectedUid = next.uid;
        }
    }

    await touchStoryboard(storyboardId);
    return { newSelectedUid };
}

/**
 * Builds the R2 object key for an uploaded storyboard image.
 *
 *     storyboard/{userUid}/{projectUid}/{shotUid}/{imageUid}.webp
 *
 * Lives next to the existing `generation/...` namespace and is served
 * by the same `storage.film-maker.net` route + dev proxy.
 *
 * `userUid` is the public `user_profile.uid` (not the Better Auth row
 * id) so the public surface stays stable across schema changes.
 */
export function buildStoryboardImageR2Key(
    userUid: string,
    projectUid: string,
    shotUid: string,
    imageUid: string,
): string {
    return `storyboard/${userUid}/${projectUid}/${shotUid}/${imageUid}.webp`;
}
