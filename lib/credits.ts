/**
 * Credit accounting — server-only.
 *
 * Owns the two-pool credit model:
 *   • subscription_credits — expiring, replaced on every billing cycle
 *   • purchased_credits    — permanent top-up balance (added in v1)
 *
 * Contract:
 *   • Every credit change is an atomic UPDATE on user_profile PLUS an
 *     insert in credit_transaction (for audit). These two writes are
 *     batched via D1's `db.batch(...)` so they succeed or fail together.
 *   • Every mutating function takes an `idempotencyKey`. The key is
 *     stored in `credit_transaction.stripe_session_id` (generic slot —
 *     it holds Stripe session ids, invoice ids, or internal keys; the
 *     prefixes never collide) and is UNIQUE-constrained. Replays are
 *     no-ops.
 *   • Grant / refresh functions REPLACE the subscription_credits balance
 *     with the plan's full allotment. Unused credits from the previous
 *     cycle are forfeit. This matches ConveX's prior model and keeps the
 *     accounting simple.
 *
 * Not yet implemented (Phase 4):
 *   • deductCredits() — atomic two-pool deduction with daily-limit check
 */

import { getDb } from "./db";
import { getPlan, isFreePlan } from "./constants";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreditBalance {
    subscriptionCredits: number;
    purchasedCredits: number;
    useExtraCredits: boolean;
    plan: string;
    dailyCreditsUsed: number;
    lastDailyReset: number;
}

// ─── Reads ──────────────────────────────────────────────────────────────────

/**
 * Returns the current credit balance for a user, or null if the
 * user_profile row doesn't exist (should only happen pre-provisioning).
 */
export async function getBalance(userId: string): Promise<CreditBalance | null> {
    const db = await getDb();
    const row = await db
        .prepare(
            `SELECT subscription_credits, purchased_credits, use_extra_credits,
                    plan, daily_credits_used, last_daily_reset
               FROM user_profile
              WHERE user_id = ?
              LIMIT 1`,
        )
        .bind(userId)
        .first<{
            subscription_credits: number;
            purchased_credits: number;
            use_extra_credits: number;
            plan: string;
            daily_credits_used: number;
            last_daily_reset: number;
        }>();

    if (!row) return null;

    return {
        subscriptionCredits: row.subscription_credits,
        purchasedCredits: row.purchased_credits,
        useExtraCredits: row.use_extra_credits === 1,
        plan: row.plan,
        dailyCreditsUsed: row.daily_credits_used,
        lastDailyReset: row.last_daily_reset,
    };
}

// ─── Idempotency helper ─────────────────────────────────────────────────────

async function wasAlreadyProcessed(idempotencyKey: string): Promise<boolean> {
    const db = await getDb();
    const row = await db
        .prepare("SELECT 1 FROM credit_transaction WHERE stripe_session_id = ? LIMIT 1")
        .bind(idempotencyKey)
        .first();
    return row !== null;
}

// ─── Grants ─────────────────────────────────────────────────────────────────

/**
 * Grants the monthly subscription credits for a plan, replacing any
 * existing subscription_credits balance. Also sets the user's plan field.
 *
 * Use cases:
 *   • First subscription activation (checkout.session.completed)
 *   • Recurring billing refresh (invoice.paid, subsequent cycles)
 *   • Plan upgrade / downgrade between paid tiers
 *
 * The subscription_credits balance is REPLACED (not added) — unused credits
 * from the prior cycle are forfeit by design. Purchased credits are never
 * touched by this function.
 */
export async function grantSubscriptionCredits(params: {
    userId: string;
    planId: string;
    idempotencyKey: string;
    description: string;
}): Promise<void> {
    const { userId, planId, idempotencyKey, description } = params;

    if (isFreePlan(planId)) {
        throw new Error(
            `Refusing to grant subscription credits for free plan "${planId}"`,
        );
    }

    const plan = getPlan(planId);
    if (!plan) {
        throw new Error(`Unknown plan: ${planId}`);
    }

    // Idempotency: if we've already processed this key, no-op.
    if (await wasAlreadyProcessed(idempotencyKey)) return;

    const db = await getDb();
    const now = Date.now();

    // Atomic batch: balance update + audit row in one round-trip.
    // If either fails, both roll back. If the INSERT fails on the UNIQUE
    // constraint (race with a concurrent worker), the UPDATE rolls back
    // and the next invocation short-circuits via wasAlreadyProcessed.
    await db.batch([
        db
            .prepare(
                `UPDATE user_profile
                    SET subscription_credits = ?,
                        plan = ?,
                        updated_at = ?
                  WHERE user_id = ?`,
            )
            .bind(plan.credits, planId, now, userId),
        db
            .prepare(
                `INSERT INTO credit_transaction
                 (user_id, amount, type, description, pool, stripe_session_id, created_at)
                 VALUES (?, ?, 'subscription_grant', ?, 'subscription', ?, ?)`,
            )
            .bind(userId, plan.credits, description, idempotencyKey, now),
    ]);
}

// ─── Downgrade ──────────────────────────────────────────────────────────────

/**
 * Downgrades a user back to the Solo (free) plan after their paid
 * subscription ends. Zeroes the subscription_credits pool and re-sets
 * the daily-limit tracker so the free-tier gate takes effect immediately.
 *
 * Purchased credits are intentionally preserved — users keep what they
 * paid for even after a subscription lapse.
 */
export async function downgradeToSolo(params: {
    userId: string;
    idempotencyKey: string;
}): Promise<void> {
    const { userId, idempotencyKey } = params;

    if (await wasAlreadyProcessed(idempotencyKey)) return;

    const db = await getDb();
    const now = Date.now();

    await db.batch([
        db
            .prepare(
                `UPDATE user_profile
                    SET subscription_credits = 0,
                        plan = 'solo',
                        daily_credits_used = 0,
                        last_daily_reset = 0,
                        updated_at = ?
                  WHERE user_id = ?`,
            )
            .bind(now, userId),
        db
            .prepare(
                `INSERT INTO credit_transaction
                 (user_id, amount, type, description, pool, stripe_session_id, created_at)
                 VALUES (?, 0, 'downgrade', 'Downgraded to Solo plan', 'subscription', ?, ?)`,
            )
            .bind(userId, idempotencyKey, now),
    ]);
}

// ─── Recent transactions ───────────────────────────────────────────────────

export interface CreditTransactionRow {
    id: number;
    amount: number;
    type: string;
    description: string;
    pool: string | null;
    createdAt: number;
}

/**
 * Returns the user's most recent credit transactions, newest first.
 * Used on the credits page for the activity feed.
 */
export async function listRecentTransactions(
    userId: string,
    limit = 20,
): Promise<CreditTransactionRow[]> {
    const db = await getDb();
    const { results } = await db
        .prepare(
            `SELECT id, amount, type, description, pool, created_at
               FROM credit_transaction
              WHERE user_id = ?
              ORDER BY created_at DESC
              LIMIT ?`,
        )
        .bind(userId, limit)
        .all<{
            id: number;
            amount: number;
            type: string;
            description: string;
            pool: string | null;
            created_at: number;
        }>();

    return results.map((r) => ({
        id: r.id,
        amount: r.amount,
        type: r.type,
        description: r.description,
        pool: r.pool,
        createdAt: r.created_at,
    }));
}
