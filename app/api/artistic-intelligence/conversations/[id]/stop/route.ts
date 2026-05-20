/**
 * POST /api/artistic-intelligence/conversations/[id]/stop
 *
 * Marks the most recent in-flight assistant reply as `stopped`. The
 * streaming endpoint detects this on its next DB read and closes the
 * stream cleanly; any tokens already on the wire are kept (the user
 * has seen them).
 *
 * Separate from the SSE endpoint so the client can signal stop from a
 * fresh request without wrestling with the streaming connection.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import {
    ConversationAccessError,
    markAssistantStopped,
} from "@/lib/artistic-intelligence";

const Body = z.object({
    anonToken: z.string().min(16).max(256).optional(),
});

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function POST(
    request: Request,
    ctx: RouteContext,
): Promise<Response> {
    const originError = validateOrigin(request);
    if (originError) return originError;

    const { id } = await ctx.params;

    let input: z.infer<typeof Body> = {};
    try {
        const raw = await request.json().catch(() => ({}));
        input = Body.parse(raw);
    } catch (err) {
        const message =
            err instanceof z.ZodError
                ? err.issues.map((i) => i.message).join("; ")
                : "Invalid request body";
        return NextResponse.json({ error: message }, { status: 400 });
    }

    const session = await getSession();
    const userId = session?.user?.id ?? null;

    try {
        await markAssistantStopped({
            conversationId: id,
            userId,
            anonToken: input.anonToken,
        });
    } catch (err) {
        if (err instanceof ConversationAccessError) {
            return NextResponse.json(
                { error: err.message },
                { status: 404 },
            );
        }
        throw err;
    }

    return NextResponse.json({ ok: true });
}
