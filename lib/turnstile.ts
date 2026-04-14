/**
 * Cloudflare Turnstile — server-side token verification.
 *
 * Called from API routes (waitlist, auth) to verify that the client
 * passed the Turnstile challenge. The client obtains a token from the
 * Turnstile widget and sends it with the request (body field or header);
 * this module validates it against Cloudflare's siteverify endpoint.
 *
 * Graceful degradation: if TURNSTILE_SECRET_KEY is not configured,
 * verification is skipped and all requests pass. This allows local
 * development and staging environments to function without Turnstile.
 */

const SITEVERIFY_URL =
    "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface VerifyResult {
    success: boolean;
    error?: string;
}

/**
 * Verifies a Turnstile response token against Cloudflare's siteverify
 * API. Returns `{ success: true }` if the token is valid, or
 * `{ success: false, error }` if it fails.
 *
 * If TURNSTILE_SECRET_KEY is not set, returns success unconditionally.
 */
export async function verifyTurnstileToken(
    token: string | null,
    ip: string | null,
): Promise<VerifyResult> {
    const secret = process.env.TURNSTILE_SECRET_KEY;

    // Skip verification if Turnstile is not configured.
    if (!secret) return { success: true };

    if (!token) {
        return { success: false, error: "Missing verification token" };
    }

    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);

    const response = await fetch(SITEVERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });

    if (!response.ok) {
        console.error(
            `[turnstile] siteverify returned ${response.status}`,
        );
        return { success: false, error: "Verification service unavailable" };
    }

    const data = (await response.json()) as { success: boolean; "error-codes"?: string[] };

    if (!data.success) {
        console.warn("[turnstile] verification failed:", data["error-codes"]);
        return { success: false, error: "Bot verification failed" };
    }

    return { success: true };
}

/**
 * Extracts the client IP from Cloudflare's headers, falling back to
 * the standard forwarded header. Used as the `remoteip` parameter
 * for siteverify.
 */
export function getClientIp(request: Request): string | null {
    return (
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for") ??
        null
    );
}
