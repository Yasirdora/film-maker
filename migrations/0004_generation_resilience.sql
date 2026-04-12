-- Idempotency key for generation requests.
-- Client-supplied UUID, scoped per user. Prevents double-submit
-- (user clicks Generate twice rapidly) from creating duplicate
-- generations and double-charging credits.
--
-- TTL: 24 hours (enforced at the application layer, not DB-level).
-- After 24h the key is ignored on lookup and the same request
-- creates a new generation.

ALTER TABLE generation ADD COLUMN idempotency_key TEXT;

-- Composite unique: same key for the same user = duplicate.
-- Different users can reuse the same key (UUIDs are per-client).
CREATE UNIQUE INDEX IF NOT EXISTS idx_generation_idempotency
    ON generation (user_id, idempotency_key);
