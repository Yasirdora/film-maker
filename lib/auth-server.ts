/**
 * Server-side auth helpers.
 *
 * Use these inside server components, route handlers, and server actions
 * when you need to read or require a session.
 *
 * Two levels of protection:
 *   • `requireSession()` — user is authenticated (may or may not have
 *     completed onboarding). Used by the /welcome page.
 *   • `requireOnboardedUser()` — user is authenticated AND has a name
 *     set (onboarding complete). Used by /dashboard, /credits, and
 *     every other protected page. Redirects to /welcome if the user
 *     hasn't completed onboarding yet.
 *
 * This two-function API makes it hard to forget the onboarding check —
 * most pages import `requireOnboardedUser`, and the name is clear
 * enough that a reviewer will catch it if the wrong one is used.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "./auth";

/**
 * Returns the current session + user, or null if unauthenticated.
 * Safe to call in any server context. Does not redirect.
 */
export async function getSession() {
    const auth = await getAuth();
    return auth.api.getSession({ headers: await headers() });
}

/**
 * Returns the current session + user, or redirects to /login.
 * Use in pages that need authentication but NOT completed onboarding
 * (i.e. the /welcome page itself).
 */
export async function requireSession(redirectTo = "/login") {
    const result = await getSession();
    if (!result?.session || !result.user) {
        redirect(redirectTo);
    }
    return result;
}

/**
 * Returns the current session + user, or redirects:
 *   • Not authenticated → /login
 *   • Authenticated but no name → /welcome (complete onboarding)
 *
 * Use in every protected page except /welcome. This is the default
 * "gate" for the application — import this unless you have a specific
 * reason to use `requireSession()` instead.
 */
export async function requireOnboardedUser() {
    const result = await requireSession();
    if (!result.user.name) {
        redirect("/welcome");
    }
    return result;
}
