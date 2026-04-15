/**
 * Better Auth configuration — Film-maker.
 *
 * Auth strategy:
 *   • Passwordless — no `emailAndPassword.enabled`
 *   • Google OAuth (primary)
 *   • Email OTP with auto-verify link (sends one email containing both
 *     a 6-digit code the user can type AND a clickable link that
 *     auto-verifies — same pattern as anthropist)
 *   • Sessions stored in D1 via the Better Auth session table
 *
 * User provisioning:
 *   When Better Auth creates a new `user` row, the
 *   `databaseHooks.user.create.after` hook inserts a matching
 *   `user_profile` row with Solo plan defaults + 100 credits.
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins/email-otp";
import { nextCookies } from "better-auth/next-js";
import { drizzle } from "drizzle-orm/d1";

import { getDb, getR2 } from "./db";
import { authSchema } from "./auth-schema";
import { sendVerificationEmail } from "./email";
import { generateUid } from "./utils";
import { SESSION_MAX_AGE_SECONDS, SUBSCRIPTION_PLANS } from "./constants";
import { logAudit } from "./audit";

const SOLO_PLAN = SUBSCRIPTION_PLANS.find((p) => p.id === "solo")!;

function getAppUrl(): string {
    return (
        process.env.BETTER_AUTH_URL ??
        process.env.NEXT_PUBLIC_APP_URL ??
        "http://localhost:3000"
    );
}

export async function getAuth() {
    const d1 = await getDb();
    const db = drizzle(d1, { schema: authSchema });

    const appUrl = getAppUrl();

    const isDev = process.env.NODE_ENV !== "production";
    const devLocalhostOrigins = isDev
        ? [
              "http://localhost:3000",
              "http://localhost:3001",
              "http://localhost:3002",
              "http://127.0.0.1:3000",
              "http://127.0.0.1:3001",
              "http://127.0.0.1:3002",
          ]
        : [];

    return betterAuth({
        appName: "Film-maker",
        baseURL: appUrl,
        secret: process.env.BETTER_AUTH_SECRET,

        database: drizzleAdapter(db, {
            provider: "sqlite",
            schema: authSchema,
        }),

        session: {
            expiresIn: SESSION_MAX_AGE_SECONDS,
            // Refresh the session expiry when the user is active, so
            // regular users don't get logged out mid-workflow. Checked
            // at most once per day to avoid unnecessary DB writes.
            updateAge: 60 * 60 * 24, // 1 day
        },

        user: {
            deleteUser: {
                enabled: true,
                beforeDelete: async (user) => {
                    await deleteUserR2Objects(user.id);
                    await logAudit({
                        userId: user.id,
                        action: "user.logout",
                        targetType: "user",
                        targetId: user.id,
                        metadata: { reason: "account_deleted" },
                    });
                },
            },
        },

        emailAndPassword: {
            enabled: false,
        },

        socialProviders: {
            google: {
                clientId: process.env.GOOGLE_CLIENT_ID ?? "",
                clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
            },
        },

        trustedOrigins: [
            appUrl,
            ...devLocalhostOrigins,
            "https://film-maker.net",
            "https://www.film-maker.net",
        ],

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
            emailOTP({
                otpLength: 6,
                expiresIn: 60 * 15, // 15 minutes
                allowedAttempts: 3,
                storeOTP: "hashed",
                rateLimit: { window: 60, max: 5 },
                sendVerificationOTP: async ({ email, otp, type }) => {
                    if (type !== "sign-in") return;

                    const autoVerifyUrl = new URL("/auth/link", appUrl);
                    autoVerifyUrl.searchParams.set("code", otp);
                    autoVerifyUrl.searchParams.set("email", email);

                    try {
                        await sendVerificationEmail({
                            email,
                            code: otp,
                            url: autoVerifyUrl.toString(),
                        });
                    } catch (err) {
                        console.error("[email-otp] sendVerificationEmail failed:", err);
                        throw err;
                    }
                },
            }),

            nextCookies(),
        ],
    });
}

// ─── User profile provisioning ──────────────────────────────────────────────

async function provisionUserProfile(userId: string): Promise<void> {
    const d1 = await getDb();
    const uid = generateUid(16);
    const now = Date.now();

    // Atomic batch: profile row + credit grant succeed or fail together.
    // INSERT OR IGNORE on user_profile guards against concurrent calls
    // (e.g., if Better Auth retries the hook). The credit_transaction
    // INSERT has no UNIQUE guard here, but the hook fires exactly once
    // per user creation, and the batch ensures both rows are written.
    await d1.batch([
        d1
            .prepare(
                `INSERT OR IGNORE INTO user_profile
                 (user_id, uid, plan, subscription_credits, purchased_credits,
                  use_extra_credits, daily_credits_used, last_daily_reset,
                  monthly_topup_usd_cents_used, monthly_topup_reset_at,
                  onboarded_at, created_at, updated_at)
                 VALUES (?, ?, 'solo', ?, 0, 1, 0, 0, 0, 0, NULL, ?, ?)`,
            )
            .bind(userId, uid, SOLO_PLAN.credits, now, now),
        d1
            .prepare(
                `INSERT INTO credit_transaction
                 (user_id, amount, type, description, pool, created_at)
                 VALUES (?, ?, 'subscription_grant', 'Solo plan signup grant', 'subscription', ?)`,
            )
            .bind(userId, SOLO_PLAN.credits, now),
    ]);
}

// ─── Account deletion — R2 cleanup ────────────────────────────────────────

/**
 * Deletes all R2 objects belonging to a user. Called from the
 * `beforeDelete` hook before Better Auth deletes the user row.
 *
 * R2 keys are prefixed with `generation/{userUid}/`, so we look up
 * the user's uid, list all objects under that prefix, and delete them
 * in batches. DB rows are handled by ON DELETE CASCADE.
 */
async function deleteUserR2Objects(userId: string): Promise<void> {
    const d1 = await getDb();

    const row = await d1
        .prepare("SELECT uid FROM user_profile WHERE user_id = ? LIMIT 1")
        .bind(userId)
        .first<{ uid: string }>();

    if (!row) return; // No profile — nothing to clean up.

    const r2 = await getR2();
    const prefix = `generation/${row.uid}/`;

    // R2 list returns up to 1000 objects per call. Loop until exhausted.
    let cursor: string | undefined;
    do {
        const listed = await r2.list({ prefix, cursor, limit: 1000 });
        if (listed.objects.length > 0) {
            await r2.delete(listed.objects.map((o) => o.key));
        }
        cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
}
