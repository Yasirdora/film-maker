/**
 * Anonymous visitor cookie.
 *
 * The Auteur chat lets signed-out users send a small number of messages
 * before they must sign in. We key that quota off an opaque
 * `fm_anon_id` cookie — not the IP, because CGNAT would lock out real
 * users, and not a localStorage value, because then every tab of the
 * same browser would have its own counter.
 *
 * The cookie is HttpOnly + SameSite=Lax; a determined visitor can still
 * clear cookies to get a fresh counter, but that's the same friction as
 * opening a new incognito window — an acceptable ceiling for a free
 * demo quota.
 */

import { generateUid } from "./utils";

const COOKIE_NAME = "fm_anon_id";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

/**
 * Core cookie parser — extracts the anon id from a raw cookie header string.
 * All other cookie-reading helpers delegate here so the parsing logic lives
 * in exactly one place.
 *
 * Used by server components that receive the cookie header directly (e.g.
 * from `cookies().toString()` in a page) as well as by
 * {@link readAnonIdFromCookie} which reads from a full Request object.
 */
export function getAnonIdFromCookieHeader(
    cookieHeader: string | null,
): string | null {
    if (!cookieHeader) return null;
    for (const part of cookieHeader.split(";")) {
        const [rawName, ...rest] = part.trim().split("=");
        if (rawName === COOKIE_NAME) return rest.join("=") || null;
    }
    return null;
}

/** Convenience wrapper — reads the anon id from a full Request object. */
export function readAnonIdFromCookie(request: Request): string | null {
    return getAnonIdFromCookieHeader(request.headers.get("cookie"));
}

/**
 * Ensures the request carries a stable anon id, generating one if missing.
 * The returned Set-Cookie string must be appended to the response headers
 * (the caller controls the response lifecycle — streamed or otherwise —
 * so we return the header instead of mutating a response here).
 */
export function ensureAnonId(
    request: Request,
): { anonId: string; setCookie: string | null } {
    const existing = readAnonIdFromCookie(request);
    if (existing) return { anonId: existing, setCookie: null };

    const anonId = generateUid(24);
    const isHttps = new URL(request.url).protocol === "https:";
    const attributes = [
        `${COOKIE_NAME}=${anonId}`,
        "Path=/",
        `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
        "SameSite=Lax",
        "HttpOnly",
        ...(isHttps ? ["Secure"] : []),
    ];
    return { anonId, setCookie: attributes.join("; ") };
}
