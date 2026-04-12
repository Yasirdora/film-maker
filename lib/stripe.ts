/**
 * Stripe — SDK instance, customer helpers, subscription mirroring.
 *
 * Runtime notes:
 *   • Uses the fetch-based HTTP client so the SDK works inside Cloudflare
 *     Workers (the default Node http client is unavailable there).
 *   • Uses SubtleCrypto for webhook signature verification — the sync
 *     `constructEvent` path requires Node crypto and will throw on Workers.
 *     Always use `constructEventAsync` in handler code.
 *   • Module-level singleton cached in `cachedStripe` — Stripe's client
 *     is stateless, so reuse is safe and avoids allocating a new instance
 *     per request.
 *
 * Data model bridge:
 *   • `ensureStripeCustomer(userId, email)` is idempotent: it reads the
 *     existing `user_profile.stripe_customer_id`, creates a customer if
 *     missing, and writes the id back. Called before checkout and portal.
 *   • `upsertSubscription` mirrors the relevant fields from Stripe's
 *     subscription object into our `subscription` table.
 *   • `deleteSubscription` removes the row; the caller is responsible for
 *     downgrading the user via `lib/credits.ts:downgradeToSolo`.
 */

import Stripe from "stripe";

import { getDb } from "./db";

// ─── Client ─────────────────────────────────────────────────────────────────

let cachedStripe: Stripe | null = null;

/**
 * Returns a Stripe SDK instance configured for Cloudflare Workers.
 * Cached per-Worker-instance (Stripe's client is stateless).
 */
export function getStripe(): Stripe {
    if (cachedStripe) return cachedStripe;

    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
        throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    cachedStripe = new Stripe(apiKey, {
        httpClient: Stripe.createFetchHttpClient(),
    });
    return cachedStripe;
}

// ─── Price id lookup ────────────────────────────────────────────────────────

/**
 * Returns the Stripe price id for a paid plan.
 *
 * The bootstrap script (`scripts/stripe-setup.mjs`) creates the products
 * and prices in the Stripe account, then prints env var lines. Paste them
 * into `.dev.vars` (local) and `wrangler secret put` (production).
 *
 * Throws on unknown or free plans — callers should never attempt to
 * checkout the solo tier.
 */
const PLAN_ENV_VARS: Record<string, string> = {
    indie: "STRIPE_PRICE_INDIE",
    creator: "STRIPE_PRICE_CREATOR",
    studio: "STRIPE_PRICE_STUDIO",
};

export function getStripePriceId(planId: string): string {
    const envVar = PLAN_ENV_VARS[planId];
    if (!envVar) {
        throw new Error(
            `No Stripe price configured for plan "${planId}". ` +
            `Run 'npm run stripe:setup' and paste the output into .dev.vars.`,
        );
    }
    const priceId = process.env[envVar];
    if (!priceId) {
        throw new Error(`Env var ${envVar} is not set`);
    }
    return priceId;
}

// ─── Customer helpers ───────────────────────────────────────────────────────

interface EnsureCustomerParams {
    userId: string;
    email: string;
    name: string | null;
}

/**
 * Returns the user's Stripe customer id, creating the customer on Stripe
 * if this is the first time.
 *
 * Race-safe: if two concurrent requests both see `stripe_customer_id IS
 * NULL` and both create a Stripe customer, the conditional UPDATE
 * (`WHERE stripe_customer_id IS NULL`) ensures only the first writer
 * wins. The loser re-reads the row to get the winner's customer ID.
 * The orphaned Stripe customer object is harmless (never charged) and
 * can be cleaned up via Stripe's dashboard if desired.
 */
export async function ensureStripeCustomer({
    userId,
    email,
    name,
}: EnsureCustomerParams): Promise<string> {
    const db = await getDb();

    // Fast path — customer already exists.
    const existing = await db
        .prepare("SELECT stripe_customer_id FROM user_profile WHERE user_id = ? LIMIT 1")
        .bind(userId)
        .first<{ stripe_customer_id: string | null }>();

    if (existing?.stripe_customer_id) {
        return existing.stripe_customer_id;
    }

    // Create the Stripe customer.
    const stripe = getStripe();
    const customer = await stripe.customers.create({
        email,
        name: name ?? undefined,
        metadata: { film_maker_user_id: userId },
    });

    // Conditional UPDATE: only write if no one else has set it yet.
    // If another request raced us and already wrote a different customer
    // ID, this UPDATE touches zero rows and we fall through to re-read.
    const result = await db
        .prepare(
            `UPDATE user_profile
                SET stripe_customer_id = ?, updated_at = ?
              WHERE user_id = ? AND stripe_customer_id IS NULL`,
        )
        .bind(customer.id, Date.now(), userId)
        .run();

    if (result.meta.changes > 0) {
        // We won the race — our customer ID is the canonical one.
        return customer.id;
    }

    // Another request set the customer ID first. Re-read to get theirs.
    const winner = await db
        .prepare("SELECT stripe_customer_id FROM user_profile WHERE user_id = ? LIMIT 1")
        .bind(userId)
        .first<{ stripe_customer_id: string | null }>();

    if (!winner?.stripe_customer_id) {
        // Should never happen — the conditional UPDATE failed because
        // someone else wrote a value, so the re-read must find it.
        throw new Error(`Failed to resolve Stripe customer for user ${userId}`);
    }

    return winner.stripe_customer_id;
}

// ─── Subscription mirror ────────────────────────────────────────────────────

interface UpsertSubscriptionParams {
    userId: string;
    subscription: Stripe.Subscription;
    planId: string;
}

/**
 * Writes a Stripe.Subscription into our `subscription` table. INSERT on
 * first call, UPDATE on subsequent calls (keyed by user_id, which is
 * UNIQUE on the table).
 */
export async function upsertSubscription({
    userId,
    subscription,
    planId,
}: UpsertSubscriptionParams): Promise<void> {
    const db = await getDb();
    const now = Date.now();

    // Since the 2025-04-30 API, billing periods moved from the subscription
    // level to the item level (so a subscription with multiple items can
    // have independent cycles). Film-maker only uses single-item
    // subscriptions, so we read the first item's period.
    const firstItem = subscription.items.data[0];
    if (!firstItem) {
        throw new Error(`Stripe subscription ${subscription.id} has no items`);
    }
    const currentPeriodStart = firstItem.current_period_start * 1000;
    const currentPeriodEnd = firstItem.current_period_end * 1000;
    const cancelAtPeriodEnd = subscription.cancel_at_period_end ? 1 : 0;

    // SQLite UPSERT via ON CONFLICT clause on the UNIQUE user_id column.
    await db
        .prepare(
            `INSERT INTO subscription
             (user_id, stripe_subscription_id, stripe_customer_id, plan, status,
              current_period_start, current_period_end, cancel_at_period_end,
              created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id) DO UPDATE SET
               stripe_subscription_id = excluded.stripe_subscription_id,
               stripe_customer_id     = excluded.stripe_customer_id,
               plan                   = excluded.plan,
               status                 = excluded.status,
               current_period_start   = excluded.current_period_start,
               current_period_end     = excluded.current_period_end,
               cancel_at_period_end   = excluded.cancel_at_period_end,
               updated_at             = excluded.updated_at`,
        )
        .bind(
            userId,
            subscription.id,
            subscription.customer as string,
            planId,
            subscription.status,
            currentPeriodStart,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            now,
            now,
        )
        .run();
}

/**
 * Removes the subscription row after Stripe cancels the subscription.
 * Call `downgradeToSolo` in lib/credits.ts separately — this function
 * only maintains the mirror table.
 */
export async function deleteSubscription(userId: string): Promise<void> {
    const db = await getDb();
    await db
        .prepare("DELETE FROM subscription WHERE user_id = ?")
        .bind(userId)
        .run();
}

// ─── User lookup by customer ────────────────────────────────────────────────

/**
 * Resolves a Stripe customer id back to a Film-maker user_id. Used inside
 * webhook handlers where Stripe gives us a customer id and we need the
 * local user. Returns null if no mapping exists (unknown customer — usually
 * a sign of a stray webhook from a different environment).
 */
export async function getUserIdByStripeCustomer(
    stripeCustomerId: string,
): Promise<string | null> {
    const db = await getDb();
    const row = await db
        .prepare("SELECT user_id FROM user_profile WHERE stripe_customer_id = ? LIMIT 1")
        .bind(stripeCustomerId)
        .first<{ user_id: string }>();
    return row?.user_id ?? null;
}

/**
 * Resolves a Stripe price id back to a Film-maker plan id by reverse-
 * lookup on the env vars populated by the setup script. Used inside the
 * webhook handler to map subscription.items[0].price.id → planId.
 */
export function getPlanIdByStripePriceId(priceId: string): string | null {
    for (const [planId, envVar] of Object.entries(PLAN_ENV_VARS)) {
        if (process.env[envVar] === priceId) {
            return planId;
        }
    }
    return null;
}
