/**
 * Next.js middleware — auth guard + Content Security Policy.
 *
 * Two responsibilities:
 *
 * 1. **Auth guard** — redirects unauthenticated users away from
 *    protected routes before the page renders. This is a fast
 *    cookie-presence check (no DB call) that acts as a safety net.
 *    Page-level `requireOnboardedUser()` remains the authoritative
 *    check (validates session, onboarding, allowlist). The middleware
 *    catches the obvious case (no cookie at all) early, so new pages
 *    added under a protected prefix are protected by default.
 *
 * 2. **CSP** — generates a cryptographic nonce per request and builds
 *    a strict Content-Security-Policy header. Next.js reads the nonce
 *    from the header and applies it to inline `<script>` tags.
 *
 * External resources whitelisted:
 *   • img-src    → storage.film-maker.net (R2 bucket CDN for generated images)
 *   • script-src → challenges.cloudflare.com (Turnstile bot protection)
 *   • frame-src  → challenges.cloudflare.com (Turnstile widget iframe)
 *
 * Everything else is restricted to 'self' or blocked entirely.
 *
 * @see https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── Auth guard ─────────────────────────────────────────────────────────────

/**
 * Route prefixes that require authentication. Any path starting with
 * one of these will redirect to /login if the session cookie is absent.
 *
 * To protect a new section of the app, add its prefix here — no
 * per-page `requireOnboardedUser()` call needed for the redirect.
 * (The page-level check is still required for full validation.)
 */
const PROTECTED_PREFIXES = [
    "/studio",
    "/auteur",
    "/credits",
    "/projects",
    "/payments",
    "/welcome",
];

/** Better Auth's default session cookie name. */
const SESSION_COOKIE = "better-auth.session_token";

function isProtectedRoute(pathname: string): boolean {
    return PROTECTED_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
    );
}

// ─── Middleware ──────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Auth guard — redirect unauthenticated users before the page renders.
    if (isProtectedRoute(pathname)) {
        const sessionCookie = request.cookies.get(SESSION_COOKIE);
        if (!sessionCookie?.value) {
            const loginUrl = request.nextUrl.clone();
            loginUrl.pathname = "/login";
            loginUrl.searchParams.set("from", pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    // CSP — applies to all routes (protected and public).
    const nonce = generateNonce();
    const csp = buildCsp(nonce);

    // Forward the nonce to the renderer so Next.js can apply it to
    // inline <script> tags, and so server components can read it via
    // `headers().get("x-nonce")` if needed.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);

    const response = NextResponse.next({
        request: { headers: requestHeaders },
    });

    response.headers.set("Content-Security-Policy", csp);

    return response;
}

// ─── CSP builder ────────────────────────────────────────────────────────────

function buildCsp(nonce: string): string {
    const isDev = process.env.NODE_ENV === "development";

    const directives: string[] = [
        // Fallback for any directive not explicitly listed below.
        "default-src 'self'",

        // Scripts: nonce-gated. 'strict-dynamic' trusts scripts loaded by
        // nonced scripts (covers Next.js code-split chunks). 'self' is a
        // fallback for browsers that don't support 'strict-dynamic'.
        // Turnstile's script is loaded dynamically by trusted code.
        // In development, React uses eval() for error overlay callstacks.
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,

        // Styles: 'unsafe-inline' is required because React's style prop
        // and Next.js's font-display optimization inject inline styles.
        // Inline style injection is low-risk (cannot execute code).
        "style-src 'self' 'unsafe-inline'",

        // Images: self-hosted + R2 bucket CDN for user-generated images.
        "img-src 'self' https://storage.film-maker.net",

        // Fonts: self-hosted via next/font/google (no external requests).
        "font-src 'self'",

        // Fetch/XHR: all API calls target same-origin /api/* routes.
        // Gemini, Gmail, and OAuth token exchange run server-side only.
        "connect-src 'self'",

        // Iframes: Turnstile renders its widget in an iframe. Stripe
        // Checkout and Customer Portal are full-page redirects, not embeds.
        "frame-src https://challenges.cloudflare.com",

        // Prevent this site from being embedded in iframes (clickjacking).
        // Supersedes X-Frame-Options for CSP-aware browsers.
        "frame-ancestors 'none'",

        // Form submissions: only to same-origin. Google OAuth is a
        // server-side 302 redirect, not a client-side form POST.
        "form-action 'self'",

        // Prevent <base> tag injection that could redirect relative URLs.
        "base-uri 'self'",

        // Block <object>, <embed>, <applet> — legacy plugin vectors.
        "object-src 'none'",

        // Auto-upgrade http:// requests to https:// on the client.
        "upgrade-insecure-requests",
    ];

    return directives.join("; ");
}

// ─── Nonce generation ───────────────────────────────────────────────────────

/**
 * Produces a base64-encoded 128-bit random nonce. Uses the Web Crypto
 * API which is available in both Cloudflare Workers and Node.js ≥ 19.
 */
function generateNonce(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Convert to base64. `btoa` expects a binary string, not raw bytes.
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// ─── Route matcher ──────────────────────────────────────────────────────────

export const config = {
    matcher: [
        // Apply to all routes except Next.js internals and static assets.
        "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    ],
};
