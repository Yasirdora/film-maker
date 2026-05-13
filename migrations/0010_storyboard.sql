-- ═══════════════════════════════════════════════════════════════════════════
-- Storyboard — pre-production layer for a project (Slice 1: data + UI only,
-- no AI generation yet — that lands in Slice 2 alongside the existing
-- Nano Banana Pro pipeline.)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Hierarchy:
--
--     project ── 1:N ── storyboard
--                          │
--                          1:N
--                          │
--                       scene ── 1:N ── shot ── 1:N ── shot_variant  (Slice 2)
--
-- A project can hold many storyboards (e.g. director's cut vs alternate
-- edit) — we use 1:N from day one rather than 1:1 so v1 doesn't require a
-- breaking migration. The current UI only ever loads the most-recently-
-- updated storyboard, but the data model is ready for siblings.
--
-- Ordering: every child carries an explicit `position` integer rather than
-- relying on insertion order. Reorder operations rewrite the positions of
-- the affected siblings inside a single SQL transaction so the list stays
-- gap-free and stable across concurrent edits.
--
-- All timestamps are integer milliseconds since epoch, matching the rest
-- of the schema (consistent with `Date.now()` in TS).

-- ───────────────────────────────────────────────────────────────────────────
-- storyboard — top-level boards belonging to a project
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE storyboard (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    uid         TEXT    NOT NULL UNIQUE,                            -- public id used in URLs
    project_id  INTEGER NOT NULL REFERENCES project (id) ON DELETE CASCADE,
    -- Owner duplicated from project so we can index/scope without joining.
    -- Always equals (SELECT user_id FROM project WHERE id = project_id);
    -- enforced in the application layer (every write goes through
    -- `getOrCreateStoryboard`, which copies the value from the parent).
    user_id     TEXT    NOT NULL REFERENCES user (id) ON DELETE CASCADE,
    title       TEXT    NOT NULL DEFAULT 'Storyboard',
    created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_storyboard_project ON storyboard (project_id, updated_at DESC);
CREATE INDEX idx_storyboard_user    ON storyboard (user_id);
CREATE INDEX idx_storyboard_uid     ON storyboard (uid);


-- ───────────────────────────────────────────────────────────────────────────
-- storyboard_scene — ordered scenes within a storyboard
-- ───────────────────────────────────────────────────────────────────────────
--
-- `slugline` follows screenplay convention (e.g. "INT. WAREHOUSE — NIGHT");
-- `action` is the prose description. Both are free text — we don't parse
-- them, but exporters (Slice 4: FDX / PDF) will rely on the slugline being
-- present for screenplay-quality output.
CREATE TABLE storyboard_scene (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    uid             TEXT    NOT NULL UNIQUE,
    storyboard_id   INTEGER NOT NULL REFERENCES storyboard (id) ON DELETE CASCADE,
    position        INTEGER NOT NULL,
    slugline        TEXT,
    action          TEXT,
    notes           TEXT,
    created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_scene_storyboard_pos ON storyboard_scene (storyboard_id, position);
CREATE INDEX idx_scene_uid            ON storyboard_scene (uid);


-- ───────────────────────────────────────────────────────────────────────────
-- storyboard_shot — ordered shots within a scene
-- ───────────────────────────────────────────────────────────────────────────
--
-- A shot is the storyboard's atom. It carries the prompt + metadata that
-- will eventually feed image and (v1) video generation. Slice 1 leaves all
-- generation fields nullable — they get populated by the AI pipeline in
-- Slice 2.
--
-- `duration_ms` is what the editor uses when computing total runtime; we
-- store milliseconds rather than seconds so the editor's frame-accurate
-- timeline (Slice 4) doesn't drift on rounding.
--
-- Vocabulary that mirrors the industry shot-list standard:
--   shot_type   : 'WIDE' | 'MEDIUM' | 'CLOSE' | 'EXTREME_CLOSE' | 'INSERT' | …
--   camera_move : 'STATIC' | 'PAN' | 'TILT' | 'DOLLY' | 'TRACK' | 'CRANE' | …
--   transition  : 'CUT' | 'DISSOLVE' | 'FADE_IN' | 'FADE_OUT' | 'WIPE' | …
-- These are stored as plain strings (no enum constraint) so adding values
-- in product doesn't require a migration. The TypeScript layer is the
-- authoritative list — see `lib/storyboards.ts`.
CREATE TABLE storyboard_shot (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    uid               TEXT    NOT NULL UNIQUE,
    scene_id          INTEGER NOT NULL REFERENCES storyboard_scene (id) ON DELETE CASCADE,
    position          INTEGER NOT NULL,

    -- Core authoring fields
    prompt            TEXT,                                          -- the AI prompt (becomes Slice-2 generation input)
    action            TEXT,                                          -- on-screen action description
    dialogue          TEXT,
    duration_ms       INTEGER NOT NULL DEFAULT 3000,                 -- planned shot length
    notes             TEXT,                                          -- private director's notes

    -- Cinematography metadata (free strings, see TS for canonical values)
    shot_type         TEXT,
    camera_move       TEXT,
    transition        TEXT,

    -- Generation linkage — populated in Slice 2 when the user runs a
    -- generation against this shot. Until then, the card renders a
    -- placeholder. `selected_variant_id` lets a shot carry multiple
    -- generated variants (alternates) and surface one as primary.
    generation_id        INTEGER REFERENCES generation (id) ON DELETE SET NULL,
    selected_variant_id  INTEGER,        -- FK added in Slice 2 once shot_variant exists

    created_at        INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at        INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_shot_scene_pos    ON storyboard_shot (scene_id, position);
CREATE INDEX idx_shot_uid          ON storyboard_shot (uid);
CREATE INDEX idx_shot_generation   ON storyboard_shot (generation_id);
