-- Pinned projects surface at the top of the user's list. `pinned_at`
-- is NULL for unpinned projects and the Unix-ms timestamp when pinned
-- otherwise; the timestamp lets multiple pinned projects sort by
-- most-recently-pinned first without an extra ordering column.
ALTER TABLE project ADD COLUMN pinned_at INTEGER;

-- Covering index for the studio list query:
--   WHERE user_id = ? AND archived_at IS NULL
--   ORDER BY pinned_at IS NULL, pinned_at DESC, updated_at DESC
-- Partial index keeps it lean — archived rows never hit this path.
CREATE INDEX idx_project_user_pin
    ON project (user_id, pinned_at DESC, updated_at DESC)
    WHERE archived_at IS NULL;
