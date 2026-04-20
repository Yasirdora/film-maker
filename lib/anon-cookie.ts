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

export function readAnonIdFromCookie(request: Request): string | null {
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) return null;
    for (const part of cookieHeader.split(";")) {
        const [rawName, ...rest] = part.trim().split("=");
        if (rawName === COOKIE_NAME) return rest.join("=") || null;
    }
    return null;
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

/**
 * Client-readable getter used by server components that need to render
 * the current anon id into a page (e.g. to display remaining quota).
 * Returns null if the cookie is missing — the caller should fall back
 * to the default anonymous state.
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
