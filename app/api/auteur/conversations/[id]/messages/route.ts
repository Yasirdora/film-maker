/**
 * /api/auteur/conversations/[id]/messages
 *
 *   GET  — list all messages in a conversation. Anonymous callers must
 *          supply `?anonToken=` proving ownership; signed-in users are
 *          matched on user_id.
 *
 *   POST — append a user message and stream the assistant response via
 *          server-sent events. The response shape is:
 *
 *            data: {"type":"message","user":{...},"assistant":{id,...}}
 *            data: {"type":"token","delta":"Hello"}
 *            data: {"type":"token","delta":" world"}
 *            data: {"type":"title","title":"Lighting for Horror"}
 *            data: {"type":"done","balance":{...}|null,"quota":{...}|null}
 *            data: {"type":"error","message":"..."}
 *
 *          Clients should treat any stream termination without a
 *          `done` or `error` as a network hiccup — the assistant row
 *          itself is the source of truth and can be re-fetched via GET.
 *
 * Cost model:
 *   • Anon callers consume one slot of the 3-response free quota per
 *     completed reply. Failed replies don't count.
 *   • Signed-in Solo users are debited 1 credit per completed reply;
 *     failures refund. Paid plans pay nothing (chat is bundled).
 */

import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import {
    getBalance,
    deductChatCredits,
    refundChatCredits,
    InsufficientCreditsError,
    type DeductionResult,
} from "@/lib/credits";
import { isFreePlan } from "@/lib/constants";
import { getR2 } from "@/lib/db";
import {
    AnonQuotaExceededError,
    ConversationAccessError,
    MAX_IMAGE_ATTACHMENTS_PER_MESSAGE,
    MAX_MESSAGE_LENGTH,
    PLACEHOLDER_TITLE,
    SOLO_CHAT_CREDIT_COST,
    consumeAnonQuota,
    getAnonQuota,
    insertAssistantPlaceholder,
    insertUserMessage,
    listMessages,
    requireConversationAccess,
    touchConversation,
    updateAssistantMessage,
    updateConversationTitleInternal,
} from "@/lib/auteur";
import { ensureAnonId } from "@/lib/anon-cookie";
import {
    ChatStreamError,
    generateConversationTitle,
    streamChat,
    type ChatHistoryItem,
} from "@/lib/gemini-chat";
import { getImageUrl } from "@/lib/image-url";
import { getProject } from "@/lib/projects";
import { logAudit } from "@/lib/audit";

// ─── Validation ─────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
] as const;

/** ~10MB raw → ~13.3MB base64. Matches the generate route's ceiling. */
const MAX_IMAGE_BASE64_LENGTH = 14_000_000;

const PostBody = z.object({
    content: z.string().max(MAX_MESSAGE_LENGTH),
    images: z
        .array(
            z.object({
                data: z
                    .string()
                    .max(MAX_IMAGE_BASE64_LENGTH, "Image too large (max 10 MB)"),
                mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES),
            }),
        )
        .max(MAX_IMAGE_ATTACHMENTS_PER_MESSAGE)
        .optional(),
    anonToken: z.string().min(16).max(256).optional(),
});

interface RouteContext {
    params: Promise<{ id: string }>;
}

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(
    request: Request,
    ctx: RouteContext,
): Promise<Response> {
    const { id } = await ctx.params;
    const url = new URL(request.url);
    const anonToken = url.searchParams.get("anonToken");

    const session = await getSession();
    const userId = session?.user?.id ?? null;

    try {
        await requireConversationAccess({
            conversationId: id,
            userId,
            anonToken,
        });
    } catch (err) {
        if (err instanceof ConversationAccessError) {
            return jsonError(err.message, 404);
        }
        throw err;
    }

    const messages = await listMessages(id);
    return Response.json({
        messages: messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            status: m.status,
            imageUrls: (m.imageR2Keys ?? []).map(getImageUrl),
            createdAt: m.createdAt,
        })),
    });
}

// ─── POST (streaming) ───────────────────────────────────────────────────────

export async function POST(
    request: Request,
    ctx: RouteContext,
): Promise<Response> {
    const originError = validateOrigin(request);
    if (originError) return originError;

    const { id: conversationId } = await ctx.params;

    let input: z.infer<typeof PostBody>;
    try {
        input = PostBody.parse(await request.json());
    } catch (err) {
        const message =
            err instanceof z.ZodError
                ? err.issues.map((i) => i.message).join("; ")
                : "Invalid request body";
        return jsonError(message, 400);
    }

    const content = input.content.trim();
    const hasImages = (input.images?.length ?? 0) > 0;
    if (content.length === 0 && !hasImages) {
        return jsonError("Message cannot be empty", 400);
    }

    // ─── Access ────────────────────────────────────────────────────────────
    const session = await getSession();
    const userId = session?.user?.id ?? null;
    let conversation;
    try {
        conversation = await requireConversationAccess({
            conversationId,
            userId,
            anonToken: input.anonToken,
        });
    } catch (err) {
        if (err instanceof ConversationAccessError) {
            return jsonError(err.message, 404);
        }
        throw err;
    }

    // ─── Spend gate (anon quota OR credits) ────────────────────────────────
    // We check the quota/credit balance BEFORE doing any writes so an
    // over-quota caller gets a clean 429/402 instead of a dangling row.
    let setCookieHeader: string | null = null;
    let anonIdForConsumption: string | null = null;
    let planId: string | null = null;
    let chatCreditCost = 0;

    if (userId) {
        const balance = await getBalance(userId);
        planId = balance.plan;
        chatCreditCost = isFreePlan(planId) ? SOLO_CHAT_CREDIT_COST : 0;
        if (chatCreditCost > 0) {
            const available =
                balance.subscriptionCredits +
                (balance.useExtraCredits ? balance.purchasedCredits : 0);
            if (available < chatCreditCost) {
                return jsonError(
                    `This reply costs ${chatCreditCost} credit. Top up or upgrade to continue.`,
                    402,
                );
            }
        }
    } else {
        const { anonId, setCookie } = ensureAnonId(request);
        anonIdForConsumption = anonId;
        setCookieHeader = setCookie;
        const quota = await getAnonQuota(anonId);
        if (quota.remaining <= 0) {
            return jsonError(
                `You've used your ${quota.limit} free Auteur replies. Sign in to continue.`,
                429,
                { code: "anon_quota_exceeded", quota },
            );
        }
    }

    // ─── Persist user message (+ image upload) ─────────────────────────────
    let imageR2Keys: string[] | null = null;
    if (hasImages && input.images) {
        try {
            imageR2Keys = await uploadImageAttachments({
                conversationId,
                images: input.images,
            });
        } catch (err) {
            console.error("[auteur/messages] image upload failed:", err);
            return jsonError(
                "Couldn't save your image attachments. Please try again.",
                500,
            );
        }
    }

    const userMessage = await insertUserMessage({
        conversationId,
        content,
        imageR2Keys,
    });

    // Placeholder so the UI can render a typing indicator immediately.
    const assistantMessage = await insertAssistantPlaceholder({
        conversationId,
    });
    await touchConversation(conversationId);

    // Count prior user messages — if this is the first, we'll ask the
    // model for a conversation title once the reply completes. We also
    // retry titling on later turns whenever the current title is still
    // the placeholder ("Drafting…"), which happens if a previous attempt
    // hit an error or returned empty.
    const allMessages = await listMessages(conversationId);
    const priorUserCount = allMessages.filter(
        (m) => m.role === "user" && m.id !== userMessage.id,
    ).length;
    const needsTitle =
        priorUserCount === 0 || conversation.title === PLACEHOLDER_TITLE;

    // Optional project context — only signed-in conversations link to projects.
    const projectContext = await buildProjectContext({
        projectId: conversation.projectId,
        userId,
    });

    // Build the Gemini-ready history. We drop pending/streaming/stopped
    // rows (incomplete context) and inline user-attached images as base64.
    const history = await buildHistoryForModel({
        messages: [
            ...allMessages.filter((m) => m.id !== assistantMessage.id),
        ],
        currentUserMessageId: userMessage.id,
        currentImages: input.images,
    });

    // ─── SSE response ──────────────────────────────────────────────────────
    const encoder = new TextEncoder();
    const requestIp =
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for") ??
        null;

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const writeEvent = (payload: unknown) => {
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
                );
            };

            let assistantText = "";
            let deduction: DeductionResult | null = null;
            let aborted = false;

            // Notify the client of the just-created rows so it can start
            // rendering a "thinking…" bubble keyed on assistantMessage.id.
            writeEvent({
                type: "message",
                user: {
                    id: userMessage.id,
                    role: "user" as const,
                    content: userMessage.content,
                    imageUrls: (userMessage.imageR2Keys ?? []).map(getImageUrl),
                    createdAt: userMessage.createdAt,
                    status: "complete",
                },
                assistant: {
                    id: assistantMessage.id,
                    role: "assistant" as const,
                    content: "",
                    createdAt: assistantMessage.createdAt,
                    status: "pending",
                },
            });

            // Reserve credits up-front so a high-cost plan never over-spends
            // if the stream is interrupted. Refunded below on error.
            if (userId && planId && chatCreditCost > 0) {
                try {
                    deduction = await deductChatCredits({
                        userId,
                        cost: chatCreditCost,
                        description: `Auteur chat (${conversation.mode})`,
                    });
                } catch (err) {
                    await updateAssistantMessage({
                        messageId: assistantMessage.id,
                        content: "",
                        status: "failed",
                    });
                    const message =
                        err instanceof InsufficientCreditsError
                            ? err.message
                            : "Couldn't reserve credits for this reply.";
                    writeEvent({ type: "error", message });
                    controller.close();
                    return;
                }
            }

            // AbortController so the fetch to Gemini is cancelled when the
            // client disconnects (tab close, user hits Stop).
            const abortController = new AbortController();
            const onClientDisconnect = () => {
                aborted = true;
                abortController.abort();
            };
            request.signal.addEventListener("abort", onClientDisconnect, {
                once: true,
            });

            try {
                const iterator = streamChat({
                    mode: conversation.mode,
                    history,
                    projectContext,
                    signal: abortController.signal,
                });

                for await (const chunk of iterator) {
                    if (aborted) break;
                    if (!chunk) continue;
                    assistantText += chunk;
                    writeEvent({ type: "token", delta: chunk });

                    // Persist progress occasionally so a sudden disconnect
                    // still leaves the partial reply recoverable. We only
                    // touch the DB every ~512 chars to keep the hot path
                    // cheap — the final flush below catches the rest.
                    if (assistantText.length % 512 < chunk.length) {
                        await updateAssistantMessage({
                            messageId: assistantMessage.id,
                            content: assistantText,
                            status: "streaming",
                        });
                    }
                }

                if (aborted) {
                    await updateAssistantMessage({
                        messageId: assistantMessage.id,
                        content: assistantText,
                        status: "stopped",
                    });
                    // Don't charge for cancelled replies.
                    if (deduction && userId && chatCreditCost > 0) {
                        await refundChatCredits({
                            userId,
                            cost: chatCreditCost,
                            deduction,
                        });
                    }
                    writeEvent({ type: "done", reason: "stopped" });
                    controller.close();
                    return;
                }

                if (assistantText.length === 0) {
                    throw new ChatStreamError(
                        "The assistant produced no output. Please try again.",
                    );
                }

                await updateAssistantMessage({
                    messageId: assistantMessage.id,
                    content: assistantText,
                    status: "complete",
                });
                await touchConversation(conversationId);

                // Consume anon quota only on successful completion.
                let anonQuota = null;
                if (!userId && anonIdForConsumption) {
                    try {
                        anonQuota = await consumeAnonQuota({
                            anonId: anonIdForConsumption,
                            ip: requestIp,
                        });
                    } catch (err) {
                        if (err instanceof AnonQuotaExceededError) {
                            // Racy final-slot case — allow this reply but
                            // surface the limit to the UI for the next try.
                            anonQuota = await getAnonQuota(anonIdForConsumption);
                        } else {
                            throw err;
                        }
                    }
                }

                // Title the conversation off the first full exchange.
                let newTitle: string | null = null;
                if (needsTitle) {
                    try {
                        newTitle = await generateConversationTitle({
                            userMessage: content,
                            assistantResponse: assistantText,
                        });
                        await updateConversationTitleInternal(
                            conversationId,
                            newTitle,
                        );
                        writeEvent({ type: "title", title: newTitle });
                    } catch (err) {
                        console.warn(
                            "[auteur/messages] title generation failed:",
                            err instanceof Error ? err.message : err,
                        );
                    }
                }

                // Emit a final balance/quota snapshot so the UI can refresh
                // the nav counter without a separate fetch round-trip.
                let balanceSnapshot = null;
                if (userId) {
                    const balance = await getBalance(userId);
                    balanceSnapshot = {
                        totalCredits:
                            balance.subscriptionCredits +
                            balance.purchasedCredits,
                        plan: balance.plan,
                    };
                }

                writeEvent({
                    type: "done",
                    reason: "complete",
                    balance: balanceSnapshot,
                    quota: anonQuota,
                });

                // Non-blocking audit log.
                try {
                    await logAudit({
                        userId: userId ?? null,
                        action: "auteur.reply",
                        targetType: "auteur_conversation",
                        targetId: conversationId,
                        metadata: {
                            mode: conversation.mode,
                            chars: assistantText.length,
                            creditCost: chatCreditCost,
                            anon: !userId,
                        },
                        ip: requestIp,
                    });
                } catch {
                    // Audit failures never break the reply.
                }
            } catch (err) {
                console.error("[auteur/messages] stream error:", err);
                const message =
                    err instanceof ChatStreamError
                        ? "The assistant couldn't respond. Please try again."
                        : "Something went wrong. Please try again.";

                await updateAssistantMessage({
                    messageId: assistantMessage.id,
                    content: assistantText,
                    status: assistantText.length > 0 ? "complete" : "failed",
                });

                // Refund credits when we failed to produce any reply at all.
                if (
                    deduction &&
                    userId &&
                    chatCreditCost > 0 &&
                    assistantText.length === 0
                ) {
                    await refundChatCredits({
                        userId,
                        cost: chatCreditCost,
                        deduction,
                    });
                }

                writeEvent({ type: "error", message });
            } finally {
                request.signal.removeEventListener("abort", onClientDisconnect);
                controller.close();
            }
        },
    });

    const headers = new Headers({
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Hint to reverse proxies not to buffer the stream.
        "X-Accel-Buffering": "no",
    });
    if (setCookieHeader) headers.append("Set-Cookie", setCookieHeader);

    return new Response(stream, { headers });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function jsonError(
    message: string,
    status: number,
    extra?: Record<string, unknown>,
): Response {
    return Response.json({ error: message, ...(extra ?? {}) }, { status });
}

async function uploadImageAttachments(params: {
    conversationId: string;
    images: Array<{ data: string; mimeType: string }>;
}): Promise<string[]> {
    const r2 = await getR2();
    const keys: string[] = [];

    for (let i = 0; i < params.images.length; i++) {
        const img = params.images[i];
        const extension = mimeToExtension(img.mimeType);
        const key = `film-maker/v1/auteur/${params.conversationId}/${Date.now()}-${i}.${extension}`;
        const binary = base64ToBytes(img.data);
        await r2.put(key, binary, {
            httpMetadata: { contentType: img.mimeType },
        });
        keys.push(key);
    }
    return keys;
}

function mimeToExtension(mime: string): string {
    switch (mime) {
        case "image/png":
            return "png";
        case "image/webp":
            return "webp";
        case "image/jpeg":
        default:
            return "jpg";
    }
}

function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function buildProjectContext(params: {
    projectId: number | null;
    userId: string | null;
}): Promise<string | null> {
    if (!params.projectId || !params.userId) return null;
    // The conversation is scoped to this user (access-checked above), so
    // fetching by (uid, userId) is safe. We look up the project by numeric
    // id first because that's what the conversation stores.
    const { getDb } = await import("@/lib/db");
    const db = await getDb();
    const row = await db
        .prepare(
            `SELECT uid, name, description FROM project
              WHERE id = ? AND user_id = ? LIMIT 1`,
        )
        .bind(params.projectId, params.userId)
        .first<{ uid: string; name: string; description: string | null }>();
    if (!row) return null;

    const project = await getProject(row.uid, params.userId);
    if (!project) return null;

    const lines = [`Project: "${project.name}"`];
    if (project.description) lines.push(`Description: ${project.description}`);
    return lines.join("\n");
}

/**
 * Converts persisted messages + the current request's inline images into
 * Gemini-ready history. Only completed messages contribute to context
 * (streaming, failed, and stopped rows are excluded so the model never
 * sees partial garbage).
 */
async function buildHistoryForModel(params: {
    messages: Awaited<ReturnType<typeof listMessages>>;
    currentUserMessageId: string;
    currentImages?: Array<{ data: string; mimeType: string }>;
}): Promise<ChatHistoryItem[]> {
    const r2 = await getR2().catch(() => null);
    const items: ChatHistoryItem[] = [];

    for (const msg of params.messages) {
        if (msg.role === "assistant" && msg.status !== "complete") continue;
        if (!msg.content && !(msg.imageR2Keys?.length ?? 0)) continue;

        let images: ChatHistoryItem["images"] = undefined;
        if (
            msg.id === params.currentUserMessageId &&
            params.currentImages?.length
        ) {
            // Fast path — we already have the base64 from this request.
            images = params.currentImages.map((img) => ({
                data: img.data,
                mimeType: img.mimeType,
            }));
        } else if (msg.imageR2Keys?.length && r2) {
            // Rehydrate old attachments by fetching them back from R2.
            // Best-effort — a missing object skips the image rather than
            // tanking the whole reply.
            const loaded = await Promise.all(
                msg.imageR2Keys.map(async (key) => {
                    const obj = await r2.get(key);
                    if (!obj) return null;
                    const buffer = await obj.arrayBuffer();
                    return {
                        data: arrayBufferToBase64(buffer),
                        mimeType:
                            obj.httpMetadata?.contentType ?? "image/jpeg",
                    };
                }),
            );
            const validImages = loaded.filter(
                (img): img is { data: string; mimeType: string } => img !== null,
            );
            if (validImages.length > 0) images = validImages;
        }

        items.push({
            role: msg.role,
            content: msg.content,
            images,
        });
    }

    return items;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(
            ...bytes.subarray(i, i + chunkSize),
        );
    }
    return btoa(binary);
}
