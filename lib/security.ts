/**
 * Shared security helpers for route handlers.
 */

// ─── Origin validation (CSRF defense) ───────────────────────────────────────

const TRUSTED_ORIGINS = new Set([
    "https://film-maker.net",
    "https://www.film-maker.net",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
]);

/**
 * Validates that a mutating request (POST, PUT, DELETE) originates from
 * a trusted origin. Browsers always send the `Origin` header on fetch
 * and form submissions — its absence on a POST strongly suggests a
 * non-browser client or a misconfigured proxy.
 *
 * Returns null if the origin is trusted, or a Response to return to
 * the client if it isn't.
 */
export function validateOrigin(request: Request): Response | null {
    const origin = request.headers.get("origin");
    if (!origin) {
        // No Origin header on a POST is suspicious — reject.
        return new Response(
            JSON.stringify({ error: "Missing Origin header" }),
            { status: 403, headers: { "Content-Type": "application/json" } },
        );
    }
    if (!TRUSTED_ORIGINS.has(origin)) {
        return new Response(
            JSON.stringify({ error: "Untrusted origin" }),
            { status: 403, headers: { "Content-Type": "application/json" } },
        );
    }
    return null;
}
