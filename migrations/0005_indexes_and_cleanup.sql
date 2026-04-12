-- ═══════════════════════════════════════════════════════════════════════════
-- 0005 — Missing indexes for analytics and query performance.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Adds indexes that were missing from the initial schema:
--   • user_profile.created_at — for user growth analytics
--   • subscription.created_at — for subscription growth analytics
--   • generation.project_id + created_at — for project detail queries
--     that list generations by project, ordered by time
--
-- These indexes become important as the dataset grows beyond ~10K rows
-- where sequential scans start to noticeably impact latency.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_user_profile_created_at
    ON user_profile (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_created_at
    ON subscription (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_project_created
    ON generation (project_id, created_at DESC);
