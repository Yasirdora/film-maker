/**
 * Rate limiting — per-user and per-IP request throttling.
 *
 * Two mechanisms:
 *
 *   1. **Per-user generation rate limit** — prevents rapid-fire abuse
 *      even from paid users. Uses the `generation` table directly
 *      (no extra table needed) to count recent requests within a
 *      sliding time window.
 *
 *   2. **Per-IP rate limit** — protects unauthenticated endpoints
 *      (waitlist, auth) from brute-force and spam. Uses the existing
 *      `ip_rate_limit` table defined in migration 0001.
 *
 * Both mechanisms use sliding windows: count requests in the last N
 * seconds and reject if over the threshold. Old ip_rate_limit rows
 * are cleaned up lazily on each check (probabilistic, ~10% of calls).
 */

import { getDb } from "./db";

// ─── Global cleanup constants ───────────────────────────────────────────────

/**
 * Entries older than this are safe to delete regardless of which endpoint
 * created them. Set to the maximum of all endpoint window sizes so we
 * never prematurely clean up entries that are still within a longer window.
 * If a new endpoint is added with a window > HOUR_MS, this must be updated.
 */
const MAX_RATE_LIMIT_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours (2× the max window)

/**
 * Maximum rows removed per cleanup sweep. Prevents a single DELETE from
 * blocking D1 for a long time if the table has grown large.
 */
const CLEANUP_BATCH_SIZE = 500;

// ─── Per-user generation rate limit ────────────────────────────────────────

/** Maximum generations per user per hour. */
const GENERATIONS_PER_USER_PER_HOUR = 30;

/** Window size for per-user generation rate limit. */
const USER_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Returns true if the user has exceeded the generation rate limit.
 * Queries the generation table directly — no extra tracking needed.
 */
export async function isUserGenerationRateLimited(
    userId: string,
): Promise<boolean> {
    const db = await getDb();
    const cutoff = Date.now() - USER_RATE_WINDOW_MS;

    const row = await db
        .prepare(
            "SELECT COUNT(*) as count FROM generation WHERE user_id = ? AND created_at > ?",
        )
        .bind(userId, cutoff)
        .first<{ count: number }>();

    return (row?.count ?? 0) >= GENERATIONS_PER_USER_PER_HOUR;
}

// ─── Per-IP rate limit ─────────────────────────────────────────────────────

interface IpRateLimitConfig {
    /** The endpoint identifier stored in the table. */
    endpoint: string;
    /** Maximum requests allowed within the window. */
    maxRequests: number;
    /** Window size in milliseconds. */
    windowMs: number;
}

/**
 * Checks and records an IP-based rate limit. Returns true if the
 * request should be rejected (limit exceeded).
 *
 * On each call:
 *   1. Count existing entries for this IP + endpoint within the window.
 *   2. If under limit, insert a new entry and return false (allowed).
 *   3. If over limit, return true (rejected) without inserting.
 *   4. Probabilistically clean up old entries (~10% of calls).
 */
export async function checkIpRateLimit(
    ip: string | null,
    config: IpRateLimitConfig,
): Promise<boolean> {
    // No IP available (shouldn't happen behind Cloudflare, but be safe).
    if (!ip) return false;

    const db = await getDb();
    const cutoff = Date.now() - config.windowMs;

    const row = await db
        .prepare(
            "SELECT COUNT(*) as count FROM ip_rate_limit WHERE ip = ? AND endpoint = ? AND created_at > ?",
        )
        .bind(ip, config.endpoint, cutoff)
        .first<{ count: number }>();

    if ((row?.count ?? 0) >= config.maxRequests) {
        return true; // Rate limited.
    }

    // Record this request.
    await db
        .prepare(
            "INSERT INTO ip_rate_limit (ip, endpoint, created_at) VALUES (?, ?, ?)",
        )
        .bind(ip, config.endpoint, Date.now())
        .run();

    // Lazy cleanup: ~10% of calls, delete stale entries.
    // We use MAX_RATE_LIMIT_AGE_MS (not the current endpoint's window) as
    // the cutoff so we never purge rows that are still within a longer-window
    // endpoint's active period. LIMIT prevents a single DELETE from blocking
    // D1 when the table has grown large.
    if (Math.random() < 0.1) {
        const globalCutoff = Date.now() - MAX_RATE_LIMIT_AGE_MS;
        await db
            .prepare(
                `DELETE FROM ip_rate_limit
                  WHERE rowid IN (
                      SELECT rowid FROM ip_rate_limit
                       WHERE created_at < ?
                       LIMIT ?
                  )`,
            )
            .bind(globalCutoff, CLEANUP_BATCH_SIZE)
            .run();
    }

    return false;
}

// ─── Pre-configured rate limit configs ─────────────────────────────────────

const HOUR_MS = 60 * 60 * 1000;
const QUARTER_HOUR_MS = 15 * 60 * 1000;

export const RATE_LIMITS = {
    waitlist: {
        endpoint: "waitlist",
        maxRequests: 5,
        windowMs: HOUR_MS,
    },
    magicLinkPerIp: {
        endpoint: "magic_link",
        maxRequests: 10,
        windowMs: HOUR_MS,
    },
    // Caps new-account creation attempts from a single IP to curb abuse
    // of the free Solo tier (3 images/day + 1 video/month per account).
    // Turnstile stops bots; this stops a human farming accounts manually.
    signupPerIp: {
        endpoint: "signup",
        maxRequests: 5,
        windowMs: HOUR_MS,
    },
    // Tighter window for login attempts — if someone is cycling through
    // email addresses trying to trigger magic links, we want to catch
    // that faster than the 1-hour general window. 8 attempts in 15 min
    // is generous for legitimate use (typos, multiple devices) but will
    // trip on automated enumeration.
    loginPerIp: {
        endpoint: "login",
        maxRequests: 8,
        windowMs: QUARTER_HOUR_MS,
    },
} as const satisfies Record<string, IpRateLimitConfig>;
