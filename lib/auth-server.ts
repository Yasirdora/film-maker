/**
 * Server-side auth helpers.
 *
 * Three levels of protection:
 *   • `getSession()` — read-only, returns null if unauthenticated.
 *   • `requireSession()` — user is authenticated (may not be onboarded).
 *     Used by /welcome.
 *   • `requireOnboardedUser()` — user is authenticated, onboarded, AND
 *     on the allowlist (if ALLOWED_EMAILS is set). Used by /studio,
 *     /auteur, /credits, and every other protected page.
 *
 * Access control:
 *   If the `ALLOWED_EMAILS` env var is set (comma-separated list of
 *   email addresses), only those users can access protected pages.
 *   Everyone else is redirected to `/`. When the var is unset or empty,
 *   all authenticated+onboarded users are allowed — remove the var to
 *   open the app to the public.
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
 * Checks whether the given email is on the access allowlist.
 *
 * If ALLOWED_EMAILS is not set or empty, everyone is allowed (open
 * access). If set, only the listed emails pass. Comparison is
 * case-insensitive.
 */
function isAllowedUser(email: string): boolean {
    const raw = process.env.ALLOWED_EMAILS;
    if (!raw || raw.trim() === "") return true; // open access
    const allowed = raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    return allowed.includes(email.toLowerCase());
}

/**
 * Returns the current session + user, or redirects:
 *   • Not authenticated → /login
 *   • Authenticated but no name → /welcome (complete onboarding)
 *   • Onboarded but not on allowlist → / (home page)
 *
 * Use in every protected page except /welcome.
 */
export async function requireOnboardedUser() {
    const result = await requireSession();
    if (!result.user.name) {
        redirect("/welcome");
    }
    if (!isAllowedUser(result.user.email)) {
        redirect("/");
    }
    return result;
}
