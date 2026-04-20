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
import {
    getPlan,
    isFreePlan,
    SOLO_DAILY_CREDIT_LIMIT,
    SOLO_MONTHLY_VIDEO_LIMIT,
    MONTHLY_TOPUP_USD_CENTS_CEILING,
    SUBSCRIPTION_PLANS,
} from "./constants";
import { generateUid } from "./utils";

export type GenerationKind = "image" | "video";

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
 * Returns the current credit balance for a user. If the user_profile
 * row is missing (databaseHooks.user.create.after failed — e.g., D1
 * timeout or UID collision), provisions it on-demand so the user isn't
 * stuck in a broken state. Logs an error so we know the hook failed.
 */
export async function getBalance(userId: string): Promise<CreditBalance> {
    const db = await getDb();
    let row = await db
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

    if (!row) {
        // Self-healing: the signup hook should have created this row.
        // If it didn't (e.g., D1 timeout), create it now so the user
        // isn't stuck. Log so we know the hook is misbehaving.
        console.error(
            `[credits] user_profile missing for user ${userId} — ` +
            `creating on-demand (signup hook may have failed)`,
        );
        await provisionProfileOnDemand(userId);
        row = await db
            .prepare(
                `SELECT subscription_credits, purchased_credits, use_extra_credits,
                        plan, daily_credits_used, last_daily_reset
                   FROM user_profile
                  WHERE user_id = ?
                  LIMIT 1`,
            )
            .bind(userId)
            .first();

        if (!row) {
            throw new Error(
                `Failed to create user_profile for user ${userId}`,
            );
        }
    }

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

// ─── Purchased credit grants ───────────────────────────────────────────────

/**
 * Adds purchased credits to a user's permanent pool after a successful
 * one-time payment. Unlike subscription credits, purchased credits
 * never expire and survive plan changes.
 *
 * Idempotent via stripe_session_id UNIQUE constraint — safe to retry.
 */
export async function grantPurchasedCredits(params: {
    userId: string;
    credits: number;
    idempotencyKey: string;
    description: string;
}): Promise<void> {
    const { userId, credits, idempotencyKey, description } = params;

    if (credits <= 0) {
        throw new Error("Credit grant amount must be positive");
    }

    if (await wasAlreadyProcessed(idempotencyKey)) return;

    const db = await getDb();
    const now = Date.now();

    await db.batch([
        db
            .prepare(
                `UPDATE user_profile
                    SET purchased_credits = purchased_credits + ?,
                        updated_at = ?
                  WHERE user_id = ?`,
            )
            .bind(credits, now, userId),
        db
            .prepare(
                `INSERT INTO credit_transaction
                 (user_id, amount, type, description, pool, stripe_session_id, created_at)
                 VALUES (?, ?, 'purchase', ?, 'purchased', ?, ?)`,
            )
            .bind(userId, credits, description, idempotencyKey, now),
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
                        monthly_videos_used = 0,
                        monthly_video_reset_at = 0,
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

// ─── Credit deduction ───────────────────────────────────────────────────────

export class InsufficientCreditsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InsufficientCreditsError";
    }
}

export class DailyLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DailyLimitError";
    }
}

export class MonthlyVideoLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MonthlyVideoLimitError";
    }
}

export interface DeductionResult {
    fromSubscription: number;
    fromPurchased: number;
}

/** Returns the start-of-day (midnight UTC) timestamp in ms. */
function todayStartUtc(): number {
    const now = new Date();
    return Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
    );
}

/**
 * Atomically deducts credits from a user's two-pool balance.
 *
 * Rules:
 *   • Subscription credits are consumed first (they expire).
 *   • Purchased credits cover the remainder IF `useExtraCredits` is on.
 *   • Solo (free) plan has a daily credit cap on images and a monthly
 *     video cap. Videos are exempt from the daily cap since a single
 *     video costs more than the daily credit allowance.
 *   • The deduction + transaction log are written in a D1 batch so they
 *     succeed or fail together.
 *
 * Throws:
 *   • `InsufficientCreditsError` if the user doesn't have enough.
 *   • `DailyLimitError` if the Solo plan's daily image cap would be exceeded.
 *   • `MonthlyVideoLimitError` if the Solo plan's monthly video cap is hit.
 */
export async function deductCredits(params: {
    userId: string;
    cost: number;
    generationId: number;
    description: string;
    kind: GenerationKind;
}): Promise<DeductionResult> {
    const { userId, cost, generationId, description, kind } = params;

    if (cost <= 0) {
        throw new Error("Credit cost must be positive");
    }

    const db = await getDb();
    const now = Date.now();
    const dayStart = todayStartUtc();
    const monthStart = getMonthStartMs();

    // Read current state.
    const profile = await db
        .prepare(
            `SELECT subscription_credits, purchased_credits,
                    use_extra_credits, plan, daily_credits_used,
                    last_daily_reset, monthly_videos_used,
                    monthly_video_reset_at
               FROM user_profile
              WHERE user_id = ?`,
        )
        .bind(userId)
        .first<{
            subscription_credits: number;
            purchased_credits: number;
            use_extra_credits: number;
            plan: string;
            daily_credits_used: number;
            last_daily_reset: number;
            monthly_videos_used: number;
            monthly_video_reset_at: number;
        }>();

    if (!profile) {
        throw new Error(`No user_profile for user ${userId}`);
    }

    const isFree = isFreePlan(profile.plan);
    const isVideo = kind === "video";

    // Daily limit check — Solo plan, images only. Videos are exempt
    // because a single video's credit cost exceeds the daily cap.
    const dailyUsed =
        profile.last_daily_reset < dayStart ? 0 : profile.daily_credits_used;

    if (isFree && !isVideo && dailyUsed + cost > SOLO_DAILY_CREDIT_LIMIT) {
        const remaining = Math.max(0, SOLO_DAILY_CREDIT_LIMIT - dailyUsed);
        throw new DailyLimitError(
            `Daily limit reached. Solo plan allows ${SOLO_DAILY_CREDIT_LIMIT} ` +
            `credits per day. You have ${remaining} remaining today. ` +
            `Upgrade for unlimited daily generations.`,
        );
    }

    // Monthly video cap — Solo plan only. Reset on first of each UTC month.
    const videosUsed =
        profile.monthly_video_reset_at < monthStart
            ? 0
            : profile.monthly_videos_used;

    if (isFree && isVideo && videosUsed + 1 > SOLO_MONTHLY_VIDEO_LIMIT) {
        throw new MonthlyVideoLimitError(
            `Monthly video limit reached. Solo plan allows ` +
            `${SOLO_MONTHLY_VIDEO_LIMIT} video per month. ` +
            `Upgrade for unlimited video generation.`,
        );
    }

    // Pool split — subscription first, purchased second.
    const subCredits = profile.subscription_credits;
    const purchCredits = profile.purchased_credits;
    const extraEnabled = profile.use_extra_credits === 1;

    const available = extraEnabled
        ? subCredits + purchCredits
        : subCredits;

    if (available < cost) {
        throw new InsufficientCreditsError(
            `This costs ${cost} credits but you have ${available}. ` +
            (extraEnabled
                ? "Purchase more credits or upgrade your plan."
                : "Enable extra credits in settings or upgrade."),
        );
    }

    const fromSubscription = Math.min(subCredits, cost);
    const fromPurchased = extraEnabled ? cost - fromSubscription : 0;

    // Images tick the daily counter; videos tick the monthly video counter.
    // Paid plans tick both harmlessly (they're never checked against).
    const nextDailyUsed = isVideo ? dailyUsed : dailyUsed + cost;
    const nextVideosUsed = isVideo ? videosUsed + 1 : videosUsed;

    // Atomic batch: deduct balance + log the transaction.
    await db.batch([
        db
            .prepare(
                `UPDATE user_profile
                    SET subscription_credits = subscription_credits - ?,
                        purchased_credits = purchased_credits - ?,
                        daily_credits_used = ?,
                        last_daily_reset = ?,
                        monthly_videos_used = ?,
                        monthly_video_reset_at = ?,
                        updated_at = ?
                  WHERE user_id = ?`,
            )
            .bind(
                fromSubscription,
                fromPurchased,
                nextDailyUsed,
                dayStart,
                nextVideosUsed,
                monthStart,
                now,
                userId,
            ),
        db
            .prepare(
                `INSERT INTO credit_transaction
                 (user_id, amount, type, description, pool, generation_id, created_at)
                 VALUES (?, ?, 'generation', ?, ?, ?, ?)`,
            )
            .bind(
                userId,
                -cost,
                description,
                fromSubscription > 0
                    ? fromPurchased > 0
                        ? "subscription+purchased"
                        : "subscription"
                    : "purchased",
                generationId,
                now,
            ),
    ]);

    return { fromSubscription, fromPurchased };
}

/**
 * Refunds credits after a failed generation. Adds the credits back to
 * the same pools they were deducted from, reverses the quota counter
 * appropriate to the kind (daily for images, monthly for videos), and
 * logs a refund transaction.
 *
 * Without the counter reversal, a Solo user who hits a Gemini safety
 * filter would permanently lose one of their 3 daily slots (image) or
 * their single monthly video slot.
 */
export async function refundCredits(params: {
    userId: string;
    cost: number;
    generationId: number;
    deduction: DeductionResult;
    kind: GenerationKind;
}): Promise<void> {
    const { userId, cost, generationId, deduction, kind } = params;
    const db = await getDb();
    const now = Date.now();
    const isVideo = kind === "video";

    // Images decrement the daily counter; videos decrement the monthly
    // video counter. Only one counter was incremented at deduction time,
    // so only one is reversed here.
    const dailyDelta = isVideo ? 0 : cost;
    const monthlyVideoDelta = isVideo ? 1 : 0;

    await db.batch([
        db
            .prepare(
                `UPDATE user_profile
                    SET subscription_credits = subscription_credits + ?,
                        purchased_credits = purchased_credits + ?,
                        daily_credits_used = MAX(0, daily_credits_used - ?),
                        monthly_videos_used = MAX(0, monthly_videos_used - ?),
                        updated_at = ?
                  WHERE user_id = ?`,
            )
            .bind(
                deduction.fromSubscription,
                deduction.fromPurchased,
                dailyDelta,
                monthlyVideoDelta,
                now,
                userId,
            ),
        db
            .prepare(
                `INSERT INTO credit_transaction
                 (user_id, amount, type, description, pool, generation_id, created_at)
                 VALUES (?, ?, 'refund', 'Generation failed — credits refunded', NULL, ?, ?)`,
            )
            .bind(userId, cost, generationId, now),
    ]);
}

// ─── Self-healing profile provision ─────────────────────────────────────────

const SOLO_PLAN = SUBSCRIPTION_PLANS.find((p) => p.id === "solo")!;

/**
 * Creates a user_profile row on-demand when `getBalance()` discovers
 * the signup hook failed. Uses INSERT OR IGNORE so a concurrent call
 * doesn't double-provision.
 */
async function provisionProfileOnDemand(userId: string): Promise<void> {
    const db = await getDb();
    const uid = generateUid(16);
    const now = Date.now();

    await db
        .prepare(
            `INSERT OR IGNORE INTO user_profile
             (user_id, uid, plan, subscription_credits, purchased_credits,
              use_extra_credits, daily_credits_used, last_daily_reset,
              monthly_videos_used, monthly_video_reset_at,
              monthly_topup_usd_cents_used, monthly_topup_reset_at,
              onboarded_at, created_at, updated_at)
             VALUES (?, ?, 'solo', ?, 0, 1, 0, 0, 0, 0, 0, 0, NULL, ?, ?)`,
        )
        .bind(userId, uid, SOLO_PLAN.credits, now, now)
        .run();
}

// ─── Monthly topup ceiling ─────────────────────────────────────────────────

/**
 * Checks whether a user has exceeded the monthly USD spend ceiling
 * for credit top-ups. The counter resets at the start of each
 * calendar month (UTC).
 *
 * Returns the remaining allowance in cents. If zero or negative,
 * the user cannot purchase more credits this month.
 */
export async function getMonthlyTopupAllowance(
    userId: string,
): Promise<{ usedCents: number; remainingCents: number }> {
    const db = await getDb();

    const row = await db
        .prepare(
            "SELECT monthly_topup_usd_cents_used, monthly_topup_reset_at FROM user_profile WHERE user_id = ?",
        )
        .bind(userId)
        .first<{ monthly_topup_usd_cents_used: number; monthly_topup_reset_at: number }>();

    if (!row) {
        return { usedCents: 0, remainingCents: MONTHLY_TOPUP_USD_CENTS_CEILING };
    }

    // Check if the counter needs resetting (new calendar month UTC).
    const now = Date.now();
    const currentMonthStart = getMonthStartMs();

    if (row.monthly_topup_reset_at < currentMonthStart) {
        // New month — reset the counter.
        await db
            .prepare(
                `UPDATE user_profile
                    SET monthly_topup_usd_cents_used = 0,
                        monthly_topup_reset_at = ?,
                        updated_at = ?
                  WHERE user_id = ?`,
            )
            .bind(now, now, userId)
            .run();
        return { usedCents: 0, remainingCents: MONTHLY_TOPUP_USD_CENTS_CEILING };
    }

    const used = row.monthly_topup_usd_cents_used;
    return {
        usedCents: used,
        remainingCents: Math.max(0, MONTHLY_TOPUP_USD_CENTS_CEILING - used),
    };
}

/**
 * Records a topup purchase against the monthly ceiling.
 * Called from the Stripe webhook after a successful checkout.
 */
export async function recordTopupSpend(
    userId: string,
    amountCents: number,
): Promise<void> {
    const db = await getDb();
    const now = Date.now();

    await db
        .prepare(
            `UPDATE user_profile
                SET monthly_topup_usd_cents_used = monthly_topup_usd_cents_used + ?,
                    monthly_topup_reset_at = CASE
                        WHEN monthly_topup_reset_at < ? THEN ?
                        ELSE monthly_topup_reset_at
                    END,
                    updated_at = ?
              WHERE user_id = ?`,
        )
        .bind(amountCents, getMonthStartMs(), now, now, userId)
        .run();
}

/** Returns the Unix ms timestamp of the start of the current UTC month. */
function getMonthStartMs(): number {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}
