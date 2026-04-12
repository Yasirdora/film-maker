/**
 * GET /auth/link
 *
 * Pretty magic-link landing route. The email embeds a link of the form
 *
 *     https://film-maker.net/auth/link?verify=TOKEN&callbackURL=/dashboard
 *
 * which is nicer than Better Auth's default
 * `/api/auth/magic-link/verify?token=...`. We used to handle this via a
 * middleware (now proxy) rewrite, but Next.js 16's proxy runs only on
 * the Node runtime and OpenNext for Cloudflare only supports Edge — a
 * hard incompatibility. Instead we ship a physical route here that
 * synthesizes a new Request pointed at Better Auth's real verify
 * endpoint and forwards it through the same auth handler in-process.
 *
 * Result: the browser sees /auth/link → (internal forward) → Better
 * Auth validates the token, sets the session cookie, and responds with
 * a redirect to callbackURL. The browser's URL bar stays on /auth/link
 * until that redirect kicks in, then jumps to /dashboard (or wherever
 * callbackURL pointed).
 *
 * A request without `verify` falls through to /login with an error
 * flag so a user who accidentally navigates to the bare path gets a
 * reasonable landing.
 */

import { getAuth } from "@/lib/auth";

export async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const verify = url.searchParams.get("verify");

    if (!verify) {
        const login = new URL("/login", url.origin);
        login.searchParams.set("error", "invalid_link");
        return Response.redirect(login.toString(), 302);
    }

    // Synthesize a request pointed at Better Auth's real verify endpoint
    // with the token and the preserved callbackURL.
    const target = new URL("/api/auth/magic-link/verify", url.origin);
    target.searchParams.set("token", verify);
    const callbackURL = url.searchParams.get("callbackURL");
    if (callbackURL) target.searchParams.set("callbackURL", callbackURL);

    const forwarded = new Request(target.toString(), {
        method: "GET",
        headers: request.headers,
    });

    const auth = await getAuth();
    return auth.handler(forwarded);
}
