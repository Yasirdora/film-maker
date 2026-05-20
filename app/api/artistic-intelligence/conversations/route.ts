/**
 * /api/artistic-intelligence/conversations
 *
 *   GET   — list the signed-in user's conversations (sidebar feed).
 *   POST  — create a new conversation. Supports both signed-in and
 *           anonymous visitors; anonymous creates return an anonToken
 *           the client must store in localStorage and present on every
 *           subsequent read/write for that conversation.
 *
 * Mode gating:
 *   • `chat` is available to every caller (free tier + anon).
 *   • `script` / `shot_list` / `storyboard` require a paid plan. We
 *     return 403 with an upgrade hint rather than silently downgrading
 *     so the UI can show a targeted CTA.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import { getBalance } from "@/lib/credits";
import {
    ARTISTIC_INTELLIGENCE_MODES,
    createConversation,
    isModeAllowedForPlan,
    listUserConversations,
    MAX_CONVERSATION_TITLE_LENGTH,
} from "@/lib/artistic-intelligence";
import { ensureAnonId } from "@/lib/anon-cookie";
import { getProject } from "@/lib/projects";

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(): Promise<Response> {
    const session = await getSession();
    if (!session?.user) {
        // Anonymous visitors track their threads in localStorage; there is
        // no server-side list for them. Return an empty array so the UI
        // doesn't branch on status codes.
        return NextResponse.json({ conversations: [] });
    }

    const conversations = await listUserConversations(session.user.id, {
        limit: 100,
    });
    return NextResponse.json({ conversations });
}

// ─── POST ───────────────────────────────────────────────────────────────────

const CreateBody = z.object({
    mode: z.enum(ARTISTIC_INTELLIGENCE_MODES).default("chat"),
    title: z.string().trim().max(MAX_CONVERSATION_TITLE_LENGTH).optional(),
    projectUid: z.string().min(1).optional(),
});

export async function POST(request: Request): Promise<Response> {
    const originError = validateOrigin(request);
    if (originError) return originError;

    let input: z.infer<typeof CreateBody>;
    try {
        input = CreateBody.parse(await request.json());
    } catch (err) {
        const message =
            err instanceof z.ZodError
                ? err.issues.map((i) => i.message).join("; ")
                : "Invalid request body";
        return NextResponse.json({ error: message }, { status: 400 });
    }

    const session = await getSession();
    const userId = session?.user?.id ?? null;

    // Mode gating — only signed-in paid users can pick non-chat modes.
    // For anon callers we require the Solo tier's chat mode.
    if (userId) {
        const balance = await getBalance(userId);
        if (!isModeAllowedForPlan(input.mode, balance.plan)) {
            return NextResponse.json(
                {
                    error: `The ${input.mode} mode is available on paid plans. Upgrade to continue.`,
                    code: "mode_locked",
                },
                { status: 403 },
            );
        }
    } else if (input.mode !== "chat") {
        return NextResponse.json(
            {
                error: "Sign in to use this mode.",
                code: "mode_requires_auth",
            },
            { status: 401 },
        );
    }

    // Optional project scope — only meaningful for signed-in users since
    // project ownership binds a project to its creator.
    let projectId: number | null = null;
    if (input.projectUid) {
        if (!userId) {
            return NextResponse.json(
                { error: "Sign in to link a conversation to a project." },
                { status: 401 },
            );
        }
        const project = await getProject(input.projectUid, userId);
        if (!project) {
            return NextResponse.json(
                { error: "Project not found" },
                { status: 404 },
            );
        }
        projectId = project.id;
    }

    // For anon callers, stamp a stable cookie so their quota persists
    // across conversations. We don't consume quota here — only on
    // assistant response — so creating conversations is always free.
    const { setCookie } = userId
        ? { setCookie: null as string | null }
        : ensureAnonId(request);

    const { conversation, anonToken } = await createConversation({
        userId,
        mode: input.mode,
        projectId,
        title: input.title,
    });

    const body = {
        conversation: {
            id: conversation.id,
            title: conversation.title,
            mode: conversation.mode,
            pinnedAt: conversation.pinnedAt,
            archivedAt: conversation.archivedAt,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
        },
        // Anon callers must persist this token locally — without it their
        // own conversation is forever inaccessible.
        anonToken,
    };

    const response = NextResponse.json(body, { status: 201 });
    if (setCookie) response.headers.append("Set-Cookie", setCookie);
    return response;
}
