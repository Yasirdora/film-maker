-- Add aspect_ratio to the generation table.
-- Stores the Gemini imageConfig aspect ratio (e.g., "1:1", "16:9", "9:16").
-- Nullable because existing pending/done rows don't have it, and it
-- defaults to "1:1" at the application level when omitted.
ALTER TABLE generation ADD COLUMN aspect_ratio TEXT;
