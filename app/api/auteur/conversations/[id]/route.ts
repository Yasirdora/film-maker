/**
 * /api/auteur/conversations/[id]
 *
 *   PATCH  — rename or pin/unpin (signed-in users only).
 *   DELETE — remove the conversation and all its messages.
 *
 * Rename / pin / delete are intentionally not available to anonymous
 * users: these management actions imply persistence across devices,
 * which anon conversations don't have. Anon users start fresh with
 * "New chat" and can always close the tab.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import {
    ConversationAccessError,
    MAX_CONVERSATION_TITLE_LENGTH,
    deleteConversation,
    renameConversation,
    setConversationArchived,
    setConversationPinned,
} from "@/lib/auteur";

interface RouteContext {
    params: Promise<{ id: string }>;
}

const PatchBody = z
    .object({
        title: z.string().trim().min(1).max(MAX_CONVERSATION_TITLE_LENGTH).optional(),
        pinned: z.boolean().optional(),
        archived: z.boolean().optional(),
    })
    .refine((o) => o.title !== undefined || o.pinned !== undefined || o.archived !== undefined, {
        message: "Nothing to update",
    });

export async function PATCH(
    request: Request,
    ctx: RouteContext,
): Promise<Response> {
    const originError = validateOrigin(request);
    if (originError) return originError;

    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;

    let input: z.infer<typeof PatchBody>;
    try {
        input = PatchBody.parse(await request.json());
    } catch (err) {
        const message =
            err instanceof z.ZodError
                ? err.issues.map((i) => i.message).join("; ")
                : "Invalid request body";
        return NextResponse.json({ error: message }, { status: 400 });
    }

    try {
        if (input.title !== undefined) {
            await renameConversation({
                conversationId: id,
                userId: session.user.id,
                title: input.title,
            });
        }
        if (input.pinned !== undefined) {
            await setConversationPinned({
                conversationId: id,
                userId: session.user.id,
                pinned: input.pinned,
            });
        }
        if (input.archived !== undefined) {
            await setConversationArchived({
                conversationId: id,
                userId: session.user.id,
                archived: input.archived,
            });
        }
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

export async function DELETE(
    request: Request,
    ctx: RouteContext,
): Promise<Response> {
    const originError = validateOrigin(request);
    if (originError) return originError;

    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;

    try {
        await deleteConversation({
            conversationId: id,
            userId: session.user.id,
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
