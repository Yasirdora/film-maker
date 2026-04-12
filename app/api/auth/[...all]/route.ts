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
 * We invoke `getAuth()` per request so the underlying Better Auth instance
 * can grab the request-scoped D1 binding from the Cloudflare context.
 * `getAuth()` is async because the D1 accessor is async.
 */

import { getAuth } from "@/lib/auth";

export async function GET(request: Request): Promise<Response> {
    const auth = await getAuth();
    return auth.handler(request);
}

export async function POST(request: Request): Promise<Response> {
    const auth = await getAuth();
    return auth.handler(request);
}
