/**
 * Edge middleware — route gating.
 *
 * Fast path that runs on every request before the route handler. We do NOT
 * perform a full session DB lookup here — Edge middleware runs in a limited
 * runtime and a DB round-trip on every request would hurt latency. Instead
 * we check for the presence of a valid Better Auth session cookie; if the
 * cookie is missing or malformed, we redirect to /login.
 *
 * Full session validation (which includes DB lookup and revocation check)
 * happens inside each protected route via `requireSession()` from
 * `lib/auth-server.ts`. So an attacker who forges a cookie gets past the
 * middleware but is blocked by the actual handler.
 *
 * This is the standard Better Auth + Next middleware pattern.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Route families that require authentication.
const PROTECTED_PREFIXES = [
    "/dashboard",
    "/project",
    "/auteur",
    "/credits",
    "/settings",
    "/payments",
    "/welcome",
];

function isProtected(pathname: string): boolean {
    return PROTECTED_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
}

export function middleware(request: NextRequest): NextResponse {
    const { pathname, search } = request.nextUrl;

    if (!isProtected(pathname)) {
        return NextResponse.next();
    }

    const sessionCookie = getSessionCookie(request);
    if (sessionCookie) {
        return NextResponse.next();
    }

    // Unauthenticated — redirect to /login with a `from` parameter so we
    // can return the user to their original destination after sign-in.
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname + search);
    return NextResponse.redirect(loginUrl);
}

// Run the middleware on everything except static assets, _next internals,
// and the Better Auth API (which must remain cookie-less for sign-in).
export const config = {
    matcher: [
        "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)",
    ],
};
