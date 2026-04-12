-- ═══════════════════════════════════════════════════════════════════════════
-- Film-maker v0 — initial schema
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Applied via `wrangler d1 migrations apply film-maker-db --local|--remote`.
--
-- Layout:
--   1. Better Auth tables   — managed by Better Auth via Drizzle adapter.
--                             Column names MUST match Better Auth's defaults
--                             so the generated queries line up. If we later
--                             change naming, regenerate via:
--                               npx @better-auth/cli generate
--   2. App tables           — Film-maker-specific state. FK to `user(id)`.
--
-- SQLite / D1 quirks to remember:
--   • No real BEGIN/COMMIT across statements in a single .sql migration —
--     wrangler applies them sequentially, each in its own implicit tx.
--   • Booleans are INTEGER 0/1.
--   • Timestamps are INTEGER milliseconds since epoch (consistent with JS
--     Date.now() and anthropist's pattern).
--   • Foreign keys are enforced by D1 unless `PRAGMA foreign_keys = OFF` is
--     set for a specific op. Table declaration order matters.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. BETTER AUTH TABLES
-- ───────────────────────────────────────────────────────────────────────────
-- Core identity + session tables required by Better Auth.
-- Schema shape matches Better Auth's default Drizzle schema so that the
-- out-of-the-box queries work without custom mapping.

-- User table. Extended by `user_profile` below for app-specific state.
CREATE TABLE user (
    id             TEXT    PRIMARY KEY,
    name           TEXT,
    email          TEXT    NOT NULL UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0, -- boolean
    image          TEXT,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL
);

CREATE INDEX idx_user_email ON user (email);


-- Session table. One row per active session. Better Auth manages
-- revocation by deleting rows here — the gap anthropist's JWT-only
-- auth left open.
CREATE TABLE session (
    id         TEXT    PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    token      TEXT    NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    user_id    TEXT    NOT NULL REFERENCES user (id) ON DELETE CASCADE
);

CREATE INDEX idx_session_user_id ON session (user_id);
CREATE INDEX idx_session_token   ON session (token);


-- Linked accounts (one per OAuth provider or credential).
-- For Google OAuth: provider_id = 'google', account_id = Google sub.
-- For email magic link: provider_id = 'email'.
CREATE TABLE account (
    id                        TEXT    PRIMARY KEY,
    account_id                TEXT    NOT NULL,
    provider_id               TEXT    NOT NULL,
    user_id                   TEXT    NOT NULL REFERENCES user (id) ON DELETE CASCADE,
    access_token              TEXT,
    refresh_token             TEXT,
    id_token                  TEXT,
    access_token_expires_at   INTEGER,
    refresh_token_expires_at  INTEGER,
    scope                     TEXT,
    password                  TEXT,
    created_at                INTEGER NOT NULL,
    updated_at                INTEGER NOT NULL
);

CREATE INDEX idx_account_user_id  ON account (user_id);
CREATE INDEX idx_account_provider ON account (provider_id, account_id);


-- Short-lived verification tokens (email OTP, magic links, email change).
CREATE TABLE verification (
    id         TEXT    PRIMARY KEY,
    identifier TEXT    NOT NULL,
    value      TEXT    NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_verification_identifier ON verification (identifier);


-- ───────────────────────────────────────────────────────────────────────────
-- 2. APP TABLES — user profile, credits, subscriptions, generations
-- ───────────────────────────────────────────────────────────────────────────

-- Extends `user` with Film-maker-specific state. One row per user.
-- Credit balance lives here (not in a separate table) so that the hot
-- deduction path is a single atomic UPDATE on one row.
CREATE TABLE user_profile (
    user_id                        TEXT    PRIMARY KEY REFERENCES user (id) ON DELETE CASCADE,
    uid                            TEXT    NOT NULL UNIQUE,        -- public opaque id used in URLs
    plan                           TEXT    NOT NULL DEFAULT 'solo', -- 'solo' | 'indie' | 'creator' | 'studio'

    -- Two-pool credit balance (ported from ConveX model).
    -- Subscription credits are consumed first, then purchased credits.
    -- `use_extra_credits` lets users preserve their permanent stash.
    subscription_credits           INTEGER NOT NULL DEFAULT 0,
    purchased_credits              INTEGER NOT NULL DEFAULT 0,
    use_extra_credits              INTEGER NOT NULL DEFAULT 1,      -- boolean

    -- Daily limit tracking — only enforced for free (solo) plan.
    -- Counter resets when `last_daily_reset` precedes start-of-day UTC.
    daily_credits_used             INTEGER NOT NULL DEFAULT 0,
    last_daily_reset               INTEGER NOT NULL DEFAULT 0,

    -- Monthly top-up USD spend ceiling (default $500, stored in cents).
    -- Resets monthly via cron. Abuse / stolen-card protection.
    monthly_topup_usd_cents_used   INTEGER NOT NULL DEFAULT 0,
    monthly_topup_reset_at         INTEGER NOT NULL DEFAULT 0,

    -- Stripe linkage (1:1 with Stripe Customer).
    stripe_customer_id             TEXT    UNIQUE,

    -- Onboarding
    onboarded_at                   INTEGER,

    created_at                     INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at                     INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_user_profile_uid             ON user_profile (uid);
CREATE INDEX idx_user_profile_stripe_customer ON user_profile (stripe_customer_id);


-- Active subscriptions mirror the relevant Stripe state.
-- One row per user (UNIQUE user_id). On cancel we soft-mark via status.
CREATE TABLE subscription (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                TEXT    NOT NULL UNIQUE REFERENCES user (id) ON DELETE CASCADE,
    stripe_subscription_id TEXT    NOT NULL UNIQUE,
    stripe_customer_id     TEXT    NOT NULL,
    plan                   TEXT    NOT NULL, -- 'indie' | 'creator' | 'studio'
    status                 TEXT    NOT NULL, -- Stripe status: active, past_due, canceled, etc.
    current_period_start   INTEGER NOT NULL,
    current_period_end     INTEGER NOT NULL,
    cancel_at_period_end   INTEGER NOT NULL DEFAULT 0,
    created_at             INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at             INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_subscription_stripe_id ON subscription (stripe_subscription_id);
CREATE INDEX idx_subscription_status    ON subscription (status);


-- Projects — top-level container for a user's filmmaking work.
-- A project holds many generations and (later) shots/timeline entries.
CREATE TABLE project (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    uid                  TEXT    NOT NULL UNIQUE,
    user_id              TEXT    NOT NULL REFERENCES user (id) ON DELETE CASCADE,
    name                 TEXT    NOT NULL,
    description          TEXT,
    cover_generation_id  INTEGER, -- FK added after generation table declared
    archived_at          INTEGER,
    created_at           INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at           INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_project_user_updated ON project (user_id, updated_at DESC);
CREATE INDEX idx_project_uid          ON project (uid);


-- Generation — one row per image generation request (v0).
-- In v1 this table will also hold video generation jobs with a `kind` column.
-- `status` is the single source of truth for the job lifecycle.
-- `output_r2_keys` is a JSON array string: '["film-maker/v1/gen/abc.png", ...]'.
CREATE TABLE generation (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    uid              TEXT    NOT NULL UNIQUE,   -- public id used in URLs
    user_id          TEXT    NOT NULL REFERENCES user (id) ON DELETE CASCADE,
    project_id       INTEGER REFERENCES project (id) ON DELETE SET NULL,

    -- Request inputs
    model            TEXT    NOT NULL,          -- 'nano-banana-pro' for v0
    prompt           TEXT    NOT NULL,
    negative_prompt  TEXT,
    resolution       TEXT    NOT NULL,          -- '1K' | '2K' | '4K'
    sample_count     INTEGER NOT NULL DEFAULT 1,

    -- Lifecycle
    status           TEXT    NOT NULL DEFAULT 'pending', -- 'pending' | 'done' | 'failed'
    output_r2_keys   TEXT,                      -- JSON array of R2 object keys
    error_message    TEXT,

    -- Accounting (what the user was charged — refunded on failure)
    credit_cost      INTEGER NOT NULL,

    -- Audit
    request_ip       TEXT,
    user_agent       TEXT,

    created_at       INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    completed_at     INTEGER,
    updated_at       INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_generation_user_created ON generation (user_id, created_at DESC);
CREATE INDEX idx_generation_project      ON generation (project_id);
CREATE INDEX idx_generation_uid          ON generation (uid);
CREATE INDEX idx_generation_status       ON generation (status);


-- Credit transaction log — one row per credit change (grant, purchase,
-- generation, refund, admin adjustment).
-- `stripe_session_id` is UNIQUE so webhook fulfillment is idempotent —
-- retried webhooks produce zero additional rows and no double-crediting.
CREATE TABLE credit_transaction (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            TEXT    NOT NULL REFERENCES user (id) ON DELETE CASCADE,

    -- Positive for credit, negative for debit.
    amount             INTEGER NOT NULL,

    -- 'subscription_grant' | 'purchase' | 'generation' | 'refund' | 'admin_grant' | 'daily_reset'
    type               TEXT    NOT NULL,
    description        TEXT    NOT NULL,

    -- For debits, which pool the credits came out of.
    -- 'subscription' | 'purchased' | NULL for grants/purchases.
    pool               TEXT,

    -- For generation-related entries, the generation row id.
    generation_id      INTEGER REFERENCES generation (id) ON DELETE SET NULL,

    -- For purchase entries, the Stripe Checkout Session id (idempotency key).
    stripe_session_id  TEXT    UNIQUE,

    created_at         INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_credit_tx_user_created ON credit_transaction (user_id, created_at DESC);


-- ───────────────────────────────────────────────────────────────────────────
-- 3. INFRASTRUCTURE TABLES — webhook idempotency, rate limits, audit
-- ───────────────────────────────────────────────────────────────────────────

-- Incoming webhook events (Stripe primarily). Used for idempotency:
-- if `event_id` already exists, the handler is a no-op. Also a handy
-- debugging ledger for production incidents.
CREATE TABLE webhook_event (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    source        TEXT    NOT NULL,         -- 'stripe'
    event_id      TEXT    NOT NULL UNIQUE,
    event_type    TEXT    NOT NULL,
    payload       TEXT    NOT NULL,         -- JSON
    processed_at  INTEGER,
    error         TEXT,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_webhook_event_source_type ON webhook_event (source, event_type);


-- Per-IP rate limit counters for unauthenticated routes
-- (signup, magic link send, Stripe checkout start).
-- Each request inserts a row; the check is a COUNT(*) over a time window.
-- A cron cleans rows older than the longest window.
CREATE TABLE ip_rate_limit (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ip          TEXT    NOT NULL,
    endpoint    TEXT    NOT NULL,           -- 'magic_link_send' | 'signup' | 'checkout'
    created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_ip_rate_limit_lookup ON ip_rate_limit (ip, endpoint, created_at);


-- Admin / moderation audit trail. Every sensitive action (ban, refund,
-- admin grant, content takedown) writes a row here. Immutable — inserts only.
CREATE TABLE audit_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      TEXT    REFERENCES user (id) ON DELETE SET NULL,  -- acting user (admin or self)
    action       TEXT    NOT NULL,          -- e.g. 'admin.refund', 'user.ban', 'takedown'
    target_type  TEXT,                      -- 'user' | 'generation' | 'project' | ...
    target_id    TEXT,
    metadata     TEXT,                      -- JSON blob for context
    ip           TEXT,
    created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_audit_log_user   ON audit_log (user_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log (action, created_at DESC);
