/**
 * Better Auth configuration — Film-maker.
 *
 * Why a factory instead of a module-level singleton:
 *   Cloudflare D1 bindings are request-scoped. They don't exist at module
 *   load time, so we can't construct a single `auth` instance once and
 *   export it. Instead, `getAuth()` builds a fresh instance per request
 *   from the current Cloudflare context's D1 binding. The overhead is
 *   modest (a few object allocations) and the code stays simple.
 *
 * Auth strategy:
 *   • Passwordless — no `emailAndPassword.enabled`
 *   • Google OAuth (primary)
 *   • Magic link email (fallback for users without Google)
 *   • Sessions stored in D1 via the Better Auth session table (this is
 *     the session-revocation story that anthropist's hand-rolled JWT
 *     auth was missing)
 *
 * User provisioning:
 *   When Better Auth creates a new `user` row, the `databaseHooks.user.create.after`
 *   hook inserts a matching `user_profile` row with the Solo plan defaults:
 *     - 100 subscription credits
 *     - plan = 'solo'
 *     - daily limit tracking reset to 0
 *   A `credit_transaction` row is written alongside for audit.
 *
 * Tokens at rest:
 *   Magic link tokens are stored hashed (`storeToken: "hashed"`). An
 *   attacker who compromises the DB cannot replay stolen magic links —
 *   only the hash is visible.
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { nextCookies } from "better-auth/next-js";
import { drizzle } from "drizzle-orm/d1";

import { getDb } from "./db";
import { authSchema } from "./auth-schema";
import { sendMagicLinkEmail } from "./email";
import { generateUid } from "./utils";
import { SUBSCRIPTION_PLANS } from "./constants";

const SOLO_PLAN = SUBSCRIPTION_PLANS.find((p) => p.id === "solo")!;

/**
 * Constructs a Better Auth instance bound to the current request's D1 binding.
 * Call inside a Next.js route handler, middleware, or server component.
 */
export function getAuth() {
    const d1 = getDb();
    const db = drizzle(d1, { schema: authSchema });

    const appUrl =
        process.env.BETTER_AUTH_URL ??
        process.env.NEXT_PUBLIC_APP_URL ??
        "http://localhost:3000";

    return betterAuth({
        appName: "Film-maker",
        baseURL: appUrl,
        secret: process.env.BETTER_AUTH_SECRET,

        database: drizzleAdapter(db, {
            provider: "sqlite",
            schema: authSchema,
        }),

        // Passwordless only — no email/password sign-in surface.
        emailAndPassword: {
            enabled: false,
        },

        // Social providers.
        socialProviders: {
            google: {
                clientId: process.env.GOOGLE_CLIENT_ID ?? "",
                clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
            },
        },

        // Production security posture. We explicitly list origins instead of
        // trusting the baseURL host to defend against misconfigured deployments.
        trustedOrigins: [
            appUrl,
            "https://film-maker.net",
            "https://www.film-maker.net",
        ],

        // Provision a user_profile row + grant signup credits the moment
        // Better Auth creates a new user (OAuth signup, magic link signup).
        databaseHooks: {
            user: {
                create: {
                    after: async (createdUser) => {
                        await provisionUserProfile(createdUser.id);
                    },
                },
            },
        },

        plugins: [
            magicLink({
                // 15 minutes matches the UX message in the email template.
                expiresIn: 60 * 15,
                // One-shot — a used link cannot be replayed.
                allowedAttempts: 1,
                // Hash at rest: DB leak doesn't reveal valid tokens.
                storeToken: "hashed",
                // Built-in rate limit: 5 requests per 60s per identifier.
                rateLimit: { window: 60, max: 5 },
                sendMagicLink: async ({ email, url }) => {
                    await sendMagicLinkEmail({ email, url });
                },
            }),

            // nextCookies() MUST be the last plugin so it can capture and
            // forward Set-Cookie headers through Next's response pipeline.
            nextCookies(),
        ],
    });
}

// ─── Internal: provision a user_profile row ────────────────────────────────
// Runs inside the `databaseHooks.user.create.after` hook. The user row is
// already committed at this point, so we can safely FK against it.

async function provisionUserProfile(userId: string): Promise<void> {
    const d1 = getDb();
    const uid = generateUid(16);
    const now = Date.now();

    // Idempotency: if the hook somehow fires twice (retries, webhook
    // crossover), the PRIMARY KEY on user_profile.user_id prevents a
    // duplicate and the INSERT OR IGNORE is a no-op.
    await d1
        .prepare(
            `INSERT OR IGNORE INTO user_profile
             (user_id, uid, plan, subscription_credits, purchased_credits,
              use_extra_credits, daily_credits_used, last_daily_reset,
              monthly_topup_usd_cents_used, monthly_topup_reset_at,
              onboarded_at, created_at, updated_at)
             VALUES (?, ?, 'solo', ?, 0, 1, 0, 0, 0, 0, NULL, ?, ?)`,
        )
        .bind(userId, uid, SOLO_PLAN.credits, now, now)
        .run();

    // Audit trail for the signup grant.
    await d1
        .prepare(
            `INSERT INTO credit_transaction
             (user_id, amount, type, description, pool, created_at)
             VALUES (?, ?, 'subscription_grant', 'Solo plan signup grant', 'subscription', ?)`,
        )
        .bind(userId, SOLO_PLAN.credits, now)
        .run();
}
