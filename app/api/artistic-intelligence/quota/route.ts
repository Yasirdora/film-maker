/**
 * GET /api/artistic-intelligence/quota
 *
 * Returns the current anonymous free-reply allowance for the caller.
 * Signed-in users get `{ signedIn: true }` and should look at their
 * credit balance instead — this endpoint is purely for the pre-login
 * banner that shows "2 of 3 free replies left".
 *
 * The anon id cookie is set on first call if missing so the counter
 * stays stable even before the user sends their first message.
 */

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { ensureAnonId } from "@/lib/anon-cookie";
import { getAnonQuota } from "@/lib/artistic-intelligence";

export async function GET(request: Request): Promise<Response> {
    const session = await getSession();
    if (session?.user) {
        return NextResponse.json({ signedIn: true });
    }

    const { anonId, setCookie } = ensureAnonId(request);
    const quota = await getAnonQuota(anonId);

    const response = NextResponse.json({
        signedIn: false,
        quota,
    });
    if (setCookie) response.headers.append("Set-Cookie", setCookie);
    return response;
}
