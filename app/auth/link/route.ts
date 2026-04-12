/**
 * GET /auth/link
 *
 * Auto-verify landing for email sign-in. The email contains both a
 * 6-digit code and a clickable link:
 *
 *     https://film-maker.net/auth/link?code=123456&email=user@example.com
 *
 * When the user clicks the link, this route calls Better Auth's
 * sign-in/email-otp endpoint server-side, gets the session cookie set
 * in the response, and redirects to /dashboard (or whatever
 * callbackURL was passed).
 *
 * Users who prefer typing the code do so from the login form directly
 * — this route is only for the click path.
 */

import { getAuth } from "@/lib/auth";

export async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const email = url.searchParams.get("email");

    if (!code || !email) {
        return Response.redirect(
            new URL("/login?error=invalid_link", url.origin).toString(),
            302,
        );
    }

    // Synthesize a POST to Better Auth's email-otp sign-in endpoint.
    const target = new URL("/api/auth/sign-in/email-otp", url.origin);

    const forwarded = new Request(target.toString(), {
        method: "POST",
        headers: new Headers({
            "Content-Type": "application/json",
            cookie: request.headers.get("cookie") ?? "",
        }),
        body: JSON.stringify({ email, otp: code }),
    });

    const auth = await getAuth();
    const response = await auth.handler(forwarded);

    if (response.ok) {
        const callbackURL =
            url.searchParams.get("callbackURL") || "/dashboard";
        const redirect = new Response(null, {
            status: 302,
            headers: { Location: callbackURL },
        });
        // Forward all Set-Cookie headers so the session is established.
        for (const cookie of response.headers.getSetCookie()) {
            redirect.headers.append("Set-Cookie", cookie);
        }
        return redirect;
    }

    // Verification failed (expired, wrong code, used up attempts).
    return Response.redirect(
        new URL("/login?error=invalid_code", url.origin).toString(),
        302,
    );
}
