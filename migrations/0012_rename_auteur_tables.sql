-- ═══════════════════════════════════════════════════════════════════════════
-- 0012 — Rename auteur tables to artistic_intelligence
-- ═══════════════════════════════════════════════════════════════════════════

-- Rename tables (SQLite updates FK references automatically)
ALTER TABLE auteur_conversation RENAME TO artistic_intelligence_conversation;
ALTER TABLE auteur_message RENAME TO artistic_intelligence_message;
ALTER TABLE auteur_anon_quota RENAME TO artistic_intelligence_anon_quota;

-- Recreate indexes with new names
DROP INDEX IF EXISTS idx_auteur_conv_user;
DROP INDEX IF EXISTS idx_auteur_conv_anon;
DROP INDEX IF EXISTS idx_auteur_conv_project;
DROP INDEX IF EXISTS idx_auteur_msg_conv;

CREATE INDEX idx_artistic_intelligence_conv_user
    ON artistic_intelligence_conversation (user_id, updated_at DESC);
CREATE INDEX idx_artistic_intelligence_conv_anon
    ON artistic_intelligence_conversation (anon_token);
CREATE INDEX idx_artistic_intelligence_conv_project
    ON artistic_intelligence_conversation (project_id);
CREATE INDEX idx_artistic_intelligence_msg_conv
    ON artistic_intelligence_message (conversation_id, created_at ASC);
