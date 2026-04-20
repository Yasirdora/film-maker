-- ═══════════════════════════════════════════════════════════════════════════
-- 0009 — Auteur chat (ported from ConveX chat.ts / chatActions.ts)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Adds persistence for the Auteur AI chatbot:
--
--   • auteur_conversation — one row per thread. Supports both authenticated
--     owners (user_id) and anonymous visitors (anon_token). On sign-in the
--     client POSTs a claim payload proving ownership of anon threads via
--     the token and we flip them to the authenticated user.
--
--   • auteur_message — one row per message. Assistant rows are created with
--     status = 'pending' before the Gemini stream starts, flipped to
--     'streaming' as tokens arrive, and 'complete' / 'failed' / 'stopped'
--     at the end. The UI reads status to show a typing indicator.
--
--   • auteur_anon_quota — per-browser counter enforcing the free 3-response
--     cap for unauthenticated visitors. Keyed on an opaque cookie value
--     (fm_anon_id), not on IP — IP sharing behind CGNAT would block real
--     users, and rotating the cookie requires clearing all cookies (same
--     bar as creating an account).
--
-- Design notes:
--   • Timestamps follow the codebase convention: INTEGER ms since epoch.
--   • Foreign keys cascade-delete messages when a conversation is removed
--     so archive/delete operations are one statement.
--   • Image attachments are persisted as a JSON array of R2 keys on the
--     message row; the UI resolves them through the existing getImageUrl()
--     helper so the R2 base URL isn't duplicated.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE auteur_conversation (
    id          TEXT    PRIMARY KEY,                                        -- short opaque uid
    user_id     TEXT    REFERENCES user (id) ON DELETE CASCADE,             -- NULL until claimed
    anon_token  TEXT,                                                       -- NULL once claimed
    title       TEXT    NOT NULL DEFAULT 'Drafting…',
    mode        TEXT    NOT NULL DEFAULT 'chat',                            -- 'chat'|'script'|'shot_list'|'storyboard'
    project_id  INTEGER REFERENCES project (id) ON DELETE SET NULL,
    pinned_at   INTEGER,
    archived_at INTEGER,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,

    -- Ownership is mutually exclusive by design — a row belongs either to a
    -- signed-in user OR to an anonymous session, never both.
    CHECK ((user_id IS NOT NULL AND anon_token IS NULL)
        OR (user_id IS NULL     AND anon_token IS NOT NULL))
);

CREATE INDEX idx_auteur_conv_user    ON auteur_conversation (user_id, updated_at DESC);
CREATE INDEX idx_auteur_conv_anon    ON auteur_conversation (anon_token);
CREATE INDEX idx_auteur_conv_project ON auteur_conversation (project_id);


CREATE TABLE auteur_message (
    id              TEXT    PRIMARY KEY,
    conversation_id TEXT    NOT NULL REFERENCES auteur_conversation (id) ON DELETE CASCADE,
    role            TEXT    NOT NULL,                                      -- 'user' | 'assistant'
    content         TEXT    NOT NULL DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'complete',                   -- 'pending'|'streaming'|'complete'|'failed'|'stopped'
    image_r2_keys   TEXT,                                                  -- JSON array of R2 object keys (user attachments)
    created_at      INTEGER NOT NULL
);

CREATE INDEX idx_auteur_msg_conv ON auteur_message (conversation_id, created_at ASC);


CREATE TABLE auteur_anon_quota (
    anon_id         TEXT    PRIMARY KEY,                                   -- opaque cookie value (fm_anon_id)
    responses_used  INTEGER NOT NULL DEFAULT 0,
    first_ip        TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);
