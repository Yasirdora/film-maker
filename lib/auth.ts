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

import { getDb } from "./db";
import { authSchema } from "./auth-schema";
import { sendVerificationEmail } from "./email";
import { generateUid } from "./utils";
import { SUBSCRIPTION_PLANS } from "./constants";

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

    await d1
        .prepare(
            `INSERT INTO credit_transaction
             (user_id, amount, type, description, pool, created_at)
             VALUES (?, ?, 'subscription_grant', 'Solo plan signup grant', 'subscription', ?)`,
        )
        .bind(userId, SOLO_PLAN.credits, now)
        .run();
}
