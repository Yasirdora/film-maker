/**
 * Server-side auth helpers.
 *
 * Use these inside server components, route handlers, and server actions
 * when you need to read or require a session. Each call performs a full
 * database lookup (not just a cookie check), so the result is always
 * authoritative.
 *
 * For cheaper cookie-presence checks in middleware, use
 * `getSessionCookie` from `better-auth/cookies` instead — it's signature-
 * aware but does not hit the DB.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "./auth";

/**
 * Returns the current session + user, or null if unauthenticated.
 * Safe to call in any server context.
 */
export async function getSession() {
    const auth = getAuth();
    return auth.api.getSession({ headers: await headers() });
}

/**
 * Returns the current session + user, or redirects to /login with a
 * `from` query param. Use in protected server components / route handlers
 * where an unauthenticated user must be kicked out.
 */
export async function requireSession(redirectTo = "/login") {
    const result = await getSession();
    if (!result?.session || !result.user) {
        redirect(redirectTo);
    }
    return result;
}
