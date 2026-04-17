-- Add `kind` column to distinguish image vs video generations.
-- Defaults to 'image' so all existing rows are backwards-compatible.
ALTER TABLE generation ADD COLUMN kind TEXT NOT NULL DEFAULT 'image';

-- Index for filtering by kind (gallery views, usage stats).
CREATE INDEX idx_generation_kind ON generation (kind, user_id, status);
