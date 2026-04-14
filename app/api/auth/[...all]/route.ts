/**
 * Better Auth catch-all handler.
 *
 * All /api/auth/* traffic is handled by Better Auth:
 *   /api/auth/sign-in/*
 *   /api/auth/sign-out
 *   /api/auth/callback/google     (OAuth redirect)
 *   /api/auth/magic-link/*        (email magic link)
 *   /api/auth/session             (session read)
 *   ...
 *
 * `getAuth()` runs per request so the underlying Better Auth instance
 * can grab the request-scoped D1 binding from the Cloudflare context.
 *
 * The email OTP send endpoint is protected by Turnstile: the client
 * passes the challenge token via the `x-turnstile-token` header, and
 * we verify it before delegating to Better Auth. This prevents bots
 * from spamming verification emails.
 */

import { getAuth } from "@/lib/auth";
import { verifyTurnstileToken, getClientIp } from "@/lib/turnstile";

export async function GET(request: Request): Promise<Response> {
    const auth = await getAuth();
    return auth.handler(request);
}

export async function POST(request: Request): Promise<Response> {
    // Turnstile gate on the OTP-send endpoint — blocks bots from
    // triggering email sends. The header is set by the login form via
    // Better Auth's `fetchOptions`. Other POST paths (sign-out, verify
    // OTP, etc.) pass through without Turnstile.
    const url = new URL(request.url);
    if (url.pathname === "/api/auth/email-otp/send-verification-otp") {
        const token = request.headers.get("x-turnstile-token");
        const ip = getClientIp(request);
        const result = await verifyTurnstileToken(token, ip);
        if (!result.success) {
            return new Response(
                JSON.stringify({ error: result.error ?? "Verification failed" }),
                { status: 403, headers: { "Content-Type": "application/json" } },
            );
        }
    }

    const auth = await getAuth();
    return auth.handler(request);
}
