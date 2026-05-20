/**
 * POST /api/artistic-intelligence/conversations/claim
 *
 * Transfers anonymous conversations to the signed-in user. Called
 * immediately after sign-in with the (id, anonToken) pairs the client
 * stored in localStorage. Each claim is only honoured when the
 * accompanying token matches the row's stored token — a mismatched
 * claim is silently skipped, so no-one can claim threads they didn't
 * create.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import { claimAnonymousConversations } from "@/lib/artistic-intelligence";

const MAX_CLAIMS_PER_REQUEST = 100;

const Body = z.object({
    claims: z
        .array(
            z.object({
                conversationId: z.string().min(1).max(64),
                anonToken: z.string().min(16).max(256),
            }),
        )
        .max(MAX_CLAIMS_PER_REQUEST),
});

export async function POST(request: Request): Promise<Response> {
    const originError = validateOrigin(request);
    if (originError) return originError;

    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let input: z.infer<typeof Body>;
    try {
        input = Body.parse(await request.json());
    } catch (err) {
        const message =
            err instanceof z.ZodError
                ? err.issues.map((i) => i.message).join("; ")
                : "Invalid request body";
        return NextResponse.json({ error: message }, { status: 400 });
    }

    const claimed = await claimAnonymousConversations({
        userId: session.user.id,
        claims: input.claims,
    });

    return NextResponse.json({ claimed });
}
