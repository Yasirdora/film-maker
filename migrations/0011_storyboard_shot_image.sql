-- ═══════════════════════════════════════════════════════════════════════════
-- Storyboard shot images — uploads + AI generations, unified.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A shot can carry multiple images (alternates / variants). One of them
-- is "selected" at any time — the rest are kept as the user's history
-- so they can A/B and revert without re-uploading or re-generating.
--
-- Sources unified:
--
--     source = 'upload'      → user-uploaded reference / sketch / photo.
--                              `r2_key` points at a WebP we converted on
--                              the client before upload. No `generation_id`.
--
--     source = 'generation'  → output of an AI generation (Slice 2 hooks
--                              this up to the existing Nano Banana Pro
--                              pipeline). `generation_id` + `variant_index`
--                              point at the source row in `generation`;
--                              `r2_key` is the same key the gen pipeline
--                              wrote, copied here for fast joins.
--
-- Selection: exactly one image per shot has `is_selected = 1`. The unique
-- partial index below enforces this at the DB level — toggling a different
-- variant requires a 2-statement batch (clear old, set new) which the
-- application wraps in a single `db.batch()` call so it's atomic.

CREATE TABLE storyboard_shot_image (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    uid             TEXT    NOT NULL UNIQUE,
    shot_id         INTEGER NOT NULL REFERENCES storyboard_shot (id) ON DELETE CASCADE,

    -- Source discriminator. Free string in TS-land but only the two
    -- canonical values are accepted by the application layer. We could
    -- add a CHECK here but keeping it open mirrors the rest of the
    -- schema's "validate in TS" stance.
    source          TEXT    NOT NULL,                        -- 'upload' | 'generation'

    -- R2 object key for the rendered image. Always WebP for uploads,
    -- whatever-the-pipeline-writes for generations (currently PNG, but
    -- the column is format-agnostic).
    r2_key          TEXT    NOT NULL,

    -- Pixel dimensions of the stored image (after WebP conversion for
    -- uploads). Stored so the UI can lay out the variant tray without
    -- waiting for the image to decode.
    width           INTEGER NOT NULL,
    height          INTEGER NOT NULL,

    -- Upload-specific metadata. Null for generation rows.
    upload_bytes    INTEGER,                                 -- WebP size on disk
    upload_origin_mime TEXT,                                 -- 'image/jpeg', 'image/png', …

    -- Generation linkage. Null for upload rows. `variant_index` is the
    -- offset into the source generation's `output_r2_keys` array — a
    -- generation can produce N images and each gets its own row here.
    generation_id   INTEGER REFERENCES generation (id) ON DELETE SET NULL,
    variant_index   INTEGER,

    is_selected     INTEGER NOT NULL DEFAULT 0,              -- boolean

    created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_shot_image_shot       ON storyboard_shot_image (shot_id, created_at DESC);
CREATE INDEX idx_shot_image_uid        ON storyboard_shot_image (uid);
CREATE INDEX idx_shot_image_generation ON storyboard_shot_image (generation_id);

-- Enforce at most one selected image per shot. SQLite supports partial
-- indexes — this index only constrains rows where `is_selected = 1`, so
-- having many alternates with `is_selected = 0` stays cheap.
CREATE UNIQUE INDEX idx_shot_image_selected
    ON storyboard_shot_image (shot_id)
    WHERE is_selected = 1;
