/**
 * Auteur workspace — the interactive chat shell.
 *
 * Layout mirrors ConveX's: a 260 px sidebar on the left (mode nav +
 * new-chat + history), a chat pane on the right (top bar + scrolling
 * messages + composer card). The rendering details — streaming caret,
 * title shimmer, orange accent, 18/6 px bubble radius — live in
 * {@link ./auteur.module.css}; this file is the runtime glue that
 * drives state, SSE consumption, anonymous-token persistence,
 * claim-on-signup, and plan gating.
 */

"use client";

import * as React from "react";
import { toast } from "sonner";
import {
    AUTEUR_MODES,
    isModeAllowedForPlan,
    type AuteurMode,
    type MessageStatus,
} from "@/lib/auteur";
import {
    clearAnonTokens,
    forgetAnonToken,
    getAnonToken,
    readAnonTokens,
    rememberAnonToken,
} from "@/lib/auteur-client";
import { AuteurSidebar, type SidebarConversation } from "./auteur-sidebar";
import { MessageBubble } from "./message-bubble";
import { AuteurComposer, type Attachment } from "./auteur-composer";
import { AuteurIcon } from "@/components/icons/auteur-icon";
import {
    DotsIcon,
    PinIcon,
    ArchiveIcon,
    EditIcon,
} from "@/components/icons/action-icons";
import { InlineRenameForm } from "@/components/inline-rename-form";
import { downloadPdf } from "@/lib/pdf";
import { setCredits as setCreditStore } from "@/lib/credit-store";
import styles from "./auteur.module.css";

// ── Icons ──────────────────────────────────────────────────────────────────

function SearchIcon({ size = 18, className }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    );
}

function ArrowLeftIcon({ size = 16, className }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
        </svg>
    );
}

function ExportIcon({ size = 16, className }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
    );
}

function PlusIcon({ size = 16, className }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
        </svg>
    );
}

// ── Types ──────────────────────────────────────────────────────────────────

interface WorkspaceProps {
    viewer:
        | {
              type: "authenticated";
              planId: string;
              totalCredits: number;
          }
        | { type: "anonymous" };
}

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    status: MessageStatus;
    imageUrls: string[];
    createdAt: number;
}

interface ConversationState extends SidebarConversation {
    messages: Message[] | null; // null = not loaded yet
}

interface AnonQuota {
    used: number;
    remaining: number;
    limit: number;
}

const ACTIVE_STATUSES: MessageStatus[] = ["pending", "streaming"];

// ─── Empty-state copy per mode ──────────────────────────────────────────────
const MODE_EMPTY_STATE: Record<
    AuteurMode,
    { title: string; description: string }
> = {
    chat: {
        title: "What are we shooting?",
        description:
            "Ask about composition, color, lighting, or anything else on your mind.",
    },
    script: {
        title: "Let's write a scene",
        description:
            "Describe the scene and I'll draft screenplay-formatted pages.",
    },
    storyboard: {
        title: "Plan your panels",
        description: "Tell me the sequence and I'll describe each panel.",
    },
};

const MODE_PLACEHOLDER: Record<AuteurMode, string> = {
    chat: "Ask Auteur…",
    script: "Describe the scene to write…",
    storyboard: "Describe the sequence to storyboard…",
};

const MODE_LABEL: Record<AuteurMode, string> = {
    chat: "Chat",
    script: "Script",
    storyboard: "Storyboard",
};

// ─── Component ──────────────────────────────────────────────────────────────

export function AuteurWorkspace({ viewer }: WorkspaceProps) {
    const [conversations, setConversations] = React.useState<
        Record<string, ConversationState>
    >({});
    const [order, setOrder] = React.useState<string[]>([]);
    const [activeId, setActiveId] = React.useState<string | null>(null);
    const [mode, setMode] = React.useState<AuteurMode>("chat");
    const [isStreaming, setIsStreaming] = React.useState(false);
    const [sidebarOpenMobile, setSidebarOpenMobile] = React.useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
    const [confirmingDeleteId, setConfirmingDeleteId] = React.useState<string | null>(null);
    const [confirmDeleteMode, setConfirmDeleteMode] = React.useState(false); // Not used currently but kept for type safety if needed
    const [anonQuota, setAnonQuota] = React.useState<AnonQuota | null>(null);
    const [totalCredits, setTotalCredits] = React.useState(
        viewer.type === "authenticated" ? viewer.totalCredits : 0,
    );

    // History View state
    const [historySearch, setHistorySearch] = React.useState("");
    const [historyFilter, setHistoryFilter] = React.useState<AuteurMode | "all">(
        "all",
    );

    const streamAbortRef = React.useRef<AbortController | null>(null);
    const activeAssistantIdRef = React.useRef<string | null>(null);
    const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
    const shouldScrollInstantRef = React.useRef(true);

    const unlockedModes = React.useMemo<ReadonlySet<AuteurMode>>(
        () =>
            new Set(
                AUTEUR_MODES.filter((m) =>
                    viewer.type === "authenticated"
                        ? isModeAllowedForPlan(m, viewer.planId)
                        : m === "chat",
                ),
            ),
        [viewer],
    );

    // ─── Boot: claim anon convs, hydrate list, fetch quota ─────────────────
    React.useEffect(() => {
        let cancelled = false;

        async function boot() {
            if (viewer.type === "authenticated") {
                const tokens = readAnonTokens();
                const claims = Object.entries(tokens).map(
                    ([conversationId, anonToken]) => ({
                        conversationId,
                        anonToken,
                    }),
                );
                if (claims.length > 0) {
                    try {
                        const res = await fetch(
                            "/api/auteur/conversations/claim",
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ claims }),
                            },
                        );
                        if (res.ok) clearAnonTokens();
                    } catch {
                        // Non-critical — re-run on next load.
                    }
                }
            } else {
                try {
                    const res = await fetch("/api/auteur/quota");
                    if (res.ok) {
                        const data = (await res.json()) as {
                            signedIn?: boolean;
                            quota?: AnonQuota;
                        };
                        if (!cancelled && data.quota) setAnonQuota(data.quota);
                    }
                } catch {
                    // Non-critical.
                }
            }

            if (viewer.type === "authenticated") {
                try {
                    const res = await fetch("/api/auteur/conversations");
                    if (!res.ok) return;
                    const data = (await res.json()) as {
                        conversations: Array<{
                            id: string;
                            title: string;
                            mode: AuteurMode;
                            updatedAt: number;
                            pinnedAt: number | null;
                            archivedAt: number | null;
                        }>;
                    };
                    if (cancelled) return;

                    const next: Record<string, ConversationState> = {};
                    const ids: string[] = [];
                    for (const c of data.conversations) {
                        ids.push(c.id);
                        next[c.id] = {
                            id: c.id,
                            title: c.title,
                            mode: c.mode,
                            updatedAt: c.updatedAt,
                            isAnonymous: false,
                            pinnedAt: c.pinnedAt ?? null,
                            archivedAt: c.archivedAt ?? null,
                            messages: null,
                        };
                    }
                    setConversations(next);
                    setOrder(ids);
                    // Standard landing view is History, no automatic selection.
                } catch {
                    // Empty state is fine.
                }
            } else {
                const tokens = readAnonTokens();
                const ids = Object.keys(tokens);
                if (ids.length === 0) return;

                const results = await Promise.all(
                    ids.map(async (id) => {
                        try {
                            const token = tokens[id];
                            const res = await fetch(
                                `/api/auteur/conversations/${id}/messages?anonToken=${encodeURIComponent(
                                    token,
                                )}`,
                            );
                            if (!res.ok) return null;
                            const body = (await res.json()) as {
                                messages: Message[];
                            };
                            return { id, messages: body.messages };
                        } catch {
                            return null;
                        }
                    }),
                );
                if (cancelled) return;

                const next: Record<string, ConversationState> = {};
                const validIds: string[] = [];
                for (const r of results) {
                    if (!r) continue;
                    const firstUser = r.messages.find(
                        (m) => m.role === "user",
                    );
                    const title = firstUser?.content.slice(0, 60) || "New chat";
                    next[r.id] = {
                        id: r.id,
                        title,
                        mode: "chat",
                        updatedAt:
                            r.messages[r.messages.length - 1]?.createdAt ??
                            Date.now(),
                        isAnonymous: true,
                        pinnedAt: null,
                        archivedAt: null,
                        messages: r.messages,
                    };
                    validIds.push(r.id);
                }
                for (const id of ids) {
                    if (!(id in next)) forgetAnonToken(id);
                }
                setConversations(next);
                setOrder(validIds);
                // Standard landing view is History, no automatic selection.
            }
        }

        void boot();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Derived view-models ────────────────────────────────────────────────
    const sidebarConversations = React.useMemo(
        () => order.map((id) => conversations[id]).filter(Boolean),
        [order, conversations],
    );
    const active = activeId ? conversations[activeId] : null;

    const updateConversation = React.useCallback(
        (id: string, patch: Partial<ConversationState>) => {
            setConversations((prev) => {
                if (!(id in prev)) return prev;
                return { ...prev, [id]: { ...prev[id], ...patch } };
            });
        },
        [],
    );

    const bumpConversationToTop = React.useCallback((id: string) => {
        setOrder((prev) => [id, ...prev.filter((e) => e !== id)]);
    }, []);

    const replaceOrAppendMessage = React.useCallback(
        (conversationId: string, message: Message) => {
            setConversations((prev) => {
                const c = prev[conversationId];
                if (!c) return prev;
                const msgs = c.messages ?? [];
                const idx = msgs.findIndex((m) => m.id === message.id);
                const nextMsgs =
                    idx >= 0
                        ? msgs.map((m, i) => (i === idx ? { ...m, ...message } : m))
                        : [...msgs, message];
                return {
                    ...prev,
                    [conversationId]: { ...c, messages: nextMsgs },
                };
            });
        },
        [],
    );

    const patchAssistantMessage = React.useCallback(
        (
            conversationId: string,
            assistantId: string,
            patch: Partial<Message>,
        ) => {
            setConversations((prev) => {
                const c = prev[conversationId];
                if (!c || !c.messages) return prev;
                const nextMsgs = c.messages.map((m) =>
                    m.id === assistantId ? { ...m, ...patch } : m,
                );
                return {
                    ...prev,
                    [conversationId]: { ...c, messages: nextMsgs },
                };
            });
        },
        [],
    );

    const ensureMessagesLoaded = React.useCallback(
        async (id: string) => {
            const existing = conversations[id];
            if (!existing || existing.messages !== null) return;
            try {
                const token = existing.isAnonymous ? getAnonToken(id) : null;
                const qs = token ? `?anonToken=${encodeURIComponent(token)}` : "";
                const res = await fetch(
                    `/api/auteur/conversations/${id}/messages${qs}`,
                );
                if (!res.ok) return;
                const body = (await res.json()) as { messages: Message[] };
                updateConversation(id, { messages: body.messages });
            } catch {
                // Keep the shell visible even if history fails.
            }
        },
        [conversations, updateConversation],
    );

    const selectConversation = React.useCallback(
        async (id: string) => {
            setActiveId(id);
            setSidebarOpenMobile(false);
            setHistorySearch("");
            shouldScrollInstantRef.current = true;
            const c = conversations[id];
            if (c) setMode(c.mode);
            await ensureMessagesLoaded(id);
        },
        [conversations, ensureMessagesLoaded],
    );

    const createConversation = React.useCallback(
        async (nextMode: AuteurMode): Promise<string | null> => {
            try {
                const res = await fetch("/api/auteur/conversations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode: nextMode }),
                });
                if (!res.ok) {
                    const body = (await res.json().catch(() => null)) as
                        | { error?: string }
                        | null;
                    toast.error(body?.error ?? "Couldn't start a new conversation.");
                    return null;
                }
                const body = (await res.json()) as {
                    conversation: {
                        id: string;
                        title: string;
                        mode: AuteurMode;
                        updatedAt: number;
                    };
                    anonToken: string | null;
                };
                if (body.anonToken) {
                    rememberAnonToken(body.conversation.id, body.anonToken);
                }
                setConversations((prev) => ({
                    ...prev,
                    [body.conversation.id]: {
                        id: body.conversation.id,
                        title: body.conversation.title,
                        mode: body.conversation.mode,
                        updatedAt: body.conversation.updatedAt,
                        isAnonymous: viewer.type === "anonymous",
                        pinnedAt: null,
                        archivedAt: null,
                        messages: [],
                    },
                }));
                setOrder((prev) => [body.conversation.id, ...prev]);
                setActiveId(body.conversation.id);
                setMode(body.conversation.mode);
                return body.conversation.id;
            } catch {
                toast.error("Couldn't start a new conversation.");
                return null;
            }
        },
        [viewer.type],
    );

    const handleNewChat = React.useCallback(async () => {
        setSidebarOpenMobile(false);
        setHistorySearch("");
        await createConversation(mode);
    }, [createConversation, mode]);

    const handleModeChange = React.useCallback(
        (next: AuteurMode) => {
            setMode(next);
            if (!active) return;
            if ((active.messages?.length ?? 0) === 0) {
                updateConversation(active.id, { mode: next });
            } else {
                void createConversation(next);
            }
        },
        [active, createConversation, updateConversation],
    );

    const handleLockedMode = React.useCallback(
        (locked: AuteurMode) => {
            const label = MODE_LABEL[locked];
            if (viewer.type === "anonymous") {
                toast.info(`Sign in to use ${label} mode.`);
            } else {
                toast.info(`${label} is available on paid plans.`);
            }
        },
        [viewer.type],
    );

    const renameConversation = React.useCallback(
        async (id: string, nextTitle: string) => {
            const trimmed = nextTitle.trim();
            if (trimmed.length === 0) return;
            try {
                const res = await fetch(`/api/auteur/conversations/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: trimmed }),
                });
                if (!res.ok) {
                    toast.error("Couldn't rename the conversation.");
                    return;
                }
                updateConversation(id, { title: trimmed });
            } catch {
                toast.error("Couldn't rename the conversation.");
            }
        },
        [updateConversation],
    );

    const handleRename = React.useCallback(
        (id: string) => {
            const current = conversations[id];
            const next = prompt("Rename conversation", current?.title ?? "");
            if (next === null) return;
            void renameConversation(id, next);
        },
        [conversations, renameConversation],
    );

    const handleDelete = React.useCallback(
        async (id: string, isConfirmed = false) => {
            if (!isConfirmed) {
                setConfirmingDeleteId(id);
                // Clear confirmation after 5 seconds of inactivity
                setTimeout(() => {
                    setConfirmingDeleteId(prev => prev === id ? null : prev);
                }, 5000);
                return;
            }

            try {
                const res = await fetch(`/api/auteur/conversations/${id}`, {
                    method: "DELETE",
                });
                if (!res.ok) {
                    toast.error("Couldn't delete the conversation.");
                    return;
                }
                setConversations((prev) => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
                setOrder((prev) => prev.filter((o) => o !== id));
                if (activeId === id) setActiveId(null);
                setConfirmingDeleteId(null);
            } catch {
                toast.error("Couldn't delete the conversation.");
            }
        },
        [activeId],
    );

    const handlePin = React.useCallback(
        async (id: string) => {
            const current = conversations[id];
            if (!current) return;
            const nextPinned = !current.pinnedAt;
            try {
                const res = await fetch(`/api/auteur/conversations/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pinned: nextPinned }),
                });
                if (!res.ok) throw new Error();
                updateConversation(id, { pinnedAt: nextPinned ? Date.now() : null });
                setOrder((prev) => {
                    const others = prev.filter((o) => o !== id);
                    if (!nextPinned) return [id, ...others]; // Just bump if newly unpinned
                    return [id, ...others]; // Already sorting pinned-first in listUserConversations
                });
            } catch {
                toast.error("Couldn't update pin status.");
            }
        },
        [conversations, updateConversation],
    );

    const handleArchive = React.useCallback(
        async (id: string) => {
            const current = conversations[id];
            if (!current) return;
            const nextArchived = !current.archivedAt;
            try {
                const res = await fetch(`/api/auteur/conversations/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ archived: nextArchived }),
                });
                if (!res.ok) throw new Error();
                updateConversation(id, { archivedAt: nextArchived ? Date.now() : null });
                if (nextArchived && activeId === id) setActiveId(null);
            } catch {
                toast.error("Couldn't update archive status.");
            }
        },
        [activeId, conversations, updateConversation],
    );

    const handleExport = React.useCallback(async () => {
        if (!active || !active.messages) return;
        await downloadPdf({
            title: active.title,
            mode: active.mode,
            messages: active.messages.map((m) => ({
                role: m.role,
                content: m.content,
            })),
        });
    }, [active]);

    const handleStop = React.useCallback(() => {
        if (!activeId) return;
        streamAbortRef.current?.abort();
        void fetch(`/api/auteur/conversations/${activeId}/stop`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                anonToken: getAnonToken(activeId) ?? undefined,
            }),
        });
    }, [activeId]);

    // ─── Send ──────────────────────────────────────────────────────────────
    const handleSend = React.useCallback(
        async ({
            content,
            attachments,
        }: {
            content: string;
            attachments: Attachment[];
        }) => {
            let conversationId = activeId;
            if (!conversationId) {
                const createdId = await createConversation(mode);
                if (!createdId) return;
                conversationId = createdId;
            }
            const targetId: string = conversationId;

            const imagesPayload = attachments.map(({ data, mimeType }) => ({
                data,
                mimeType,
            }));
            const anonToken = getAnonToken(targetId);

            const abort = new AbortController();
            streamAbortRef.current = abort;
            setIsStreaming(true);
            bumpConversationToTop(targetId);
            shouldScrollInstantRef.current = false;

            try {
                const res = await fetch(
                    `/api/auteur/conversations/${targetId}/messages`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            content,
                            images: imagesPayload.length
                                ? imagesPayload
                                : undefined,
                            anonToken: anonToken ?? undefined,
                        }),
                        signal: abort.signal,
                    },
                );

                if (!res.ok || !res.body) {
                    const body = (await res.json().catch(() => null)) as
                        | { error?: string; code?: string; quota?: AnonQuota }
                        | null;
                    if (body?.code === "anon_quota_exceeded" && body.quota) {
                        setAnonQuota(body.quota);
                    }
                    toast.error(body?.error ?? "Your message couldn't be sent.");
                    return;
                }

                let streamingContent = "";

                await consumeSseStream(res.body, {
                    onEvent: (event) => {
                        switch (event.type) {
                            case "message":
                                activeAssistantIdRef.current =
                                    event.assistant.id;
                                streamingContent = "";
                                replaceOrAppendMessage(targetId, {
                                    ...event.user,
                                    imageUrls: event.user.imageUrls ?? [],
                                });
                                replaceOrAppendMessage(targetId, {
                                    ...event.assistant,
                                    imageUrls: [],
                                });
                                break;
                            case "token": {
                                const assistantId =
                                    activeAssistantIdRef.current;
                                if (!assistantId) break;
                                streamingContent += event.delta;
                                patchAssistantMessage(targetId, assistantId, {
                                    content: streamingContent,
                                    status: "streaming",
                                });
                                break;
                            }
                            case "title":
                                updateConversation(targetId, {
                                    title: event.title,
                                });
                                break;
                            case "done": {
                                const assistantId =
                                    activeAssistantIdRef.current;
                                if (assistantId) {
                                    patchAssistantMessage(targetId, assistantId, {
                                        status:
                                            event.reason === "stopped"
                                                ? "stopped"
                                                : "complete",
                                    });
                                }
                                if (event.balance) {
                                    setTotalCredits(event.balance.totalCredits);
                                    setCreditStore(event.balance.totalCredits);
                                }
                                if (event.quota) setAnonQuota(event.quota);
                                break;
                            }
                            case "error": {
                                const assistantId =
                                    activeAssistantIdRef.current;
                                if (assistantId) {
                                    patchAssistantMessage(targetId, assistantId, {
                                        status: "failed",
                                    });
                                }
                                toast.error(event.message);
                                break;
                            }
                        }
                    },
                });
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") {
                    return;
                }
                toast.error("Something went wrong while streaming the reply.");
            } finally {
                setIsStreaming(false);
                streamAbortRef.current = null;
                activeAssistantIdRef.current = null;
            }
        },
        [
            activeId,
            bumpConversationToTop,
            createConversation,
            mode,
            patchAssistantMessage,
            replaceOrAppendMessage,
            updateConversation,
        ],
    );

    // ─── URL ↔ activeId sync ───────────────────────────────────────────────
    // Each conversation gets its own shareable URL via ?cue=<id>. We use
    // history.replaceState (not router.replace) so the Next.js router tree
    // doesn't remount the workspace on every selection.
    React.useEffect(() => {
        const url = new URL(window.location.href);
        const current = url.searchParams.get("cue");
        if (activeId) {
            if (current === activeId) return;
            url.searchParams.set("cue", activeId);
        } else {
            if (!current) return;
            url.searchParams.delete("cue");
        }
        window.history.replaceState(null, "", url.toString());
    }, [activeId]);

    // Hydrate activeId from ?cue=<id> once the conversation list lands.
    const hydratedFromUrlRef = React.useRef(false);
    React.useEffect(() => {
        if (hydratedFromUrlRef.current) return;
        if (Object.keys(conversations).length === 0) return;
        const target = new URLSearchParams(window.location.search).get("cue");
        if (!target) {
            hydratedFromUrlRef.current = true;
            return;
        }
        if (conversations[target]) {
            hydratedFromUrlRef.current = true;
            void selectConversation(target);
        }
    }, [conversations, selectConversation]);

    // ─── Homepage prompt handoff (?q=…) ────────────────────────────────────
    // The landing hero pushes /auteur?q=<prompt>. Drain the query param,
    // create a fresh conversation, and fire handleSend — matches ConveX's
    // initial-prompt handler (app/auteur/page.tsx).
    const handledInitialPromptRef = React.useRef(false);
    React.useEffect(() => {
        if (handledInitialPromptRef.current) return;
        const params = new URLSearchParams(window.location.search);
        const initialPrompt = params.get("q");
        if (!initialPrompt) return;
        handledInitialPromptRef.current = true;

        // Strip `q` immediately so a reload doesn't re-submit the prompt.
        params.delete("q");
        const search = params.toString();
        const nextUrl =
            window.location.pathname + (search ? `?${search}` : "");
        window.history.replaceState(null, "", nextUrl);

        void handleSend({ content: initialPrompt, attachments: [] });
    }, [handleSend]);

    // ─── Auto-scroll on new tokens ─────────────────────────────────────────
    React.useLayoutEffect(() => {
        const el = messagesEndRef.current;
        if (!el) return;
        el.scrollIntoView({
            behavior: shouldScrollInstantRef.current ? "auto" : "smooth",
            block: "end",
        });
    }, [conversations, activeId, isStreaming]);

    // ─── Render ────────────────────────────────────────────────────────────
    const messages = active?.messages ?? [];
    const showEmptyState = !active || messages.length === 0;

    const composerHint =
        viewer.type === "anonymous" && anonQuota
            ? anonQuota.remaining > 0
                ? `${anonQuota.remaining} of ${anonQuota.limit} free replies left`
                : null
            : null;

    const composerHintAction =
        viewer.type === "anonymous" && anonQuota?.remaining === 0
            ? { label: "Sign in", href: "/login" }
            : undefined;

    const showQuotaGate =
        viewer.type === "anonymous" &&
        anonQuota !== null &&
        anonQuota.remaining === 0;

    const showLowCreditGate =
        viewer.type === "authenticated" && totalCredits === 0;

    return (
        <div className={styles.page}>
            <div className={styles.layout}>
                {/* Mobile sidebar scrim */}
                {sidebarOpenMobile && (
                    <div
                        className={styles.mobileSidebarScrim}
                        onClick={() => setSidebarOpenMobile(false)}
                        role="presentation"
                    />
                )}

                {/* Unified Sidebar (Desktop & Mobile) */}
                <AuteurSidebar
                    mode={mode}
                    onModeChange={(next) => {
                        handleModeChange(next);
                        if (sidebarOpenMobile) setSidebarOpenMobile(false);
                    }}
                    unlockedModes={unlockedModes}
                    onLockedMode={handleLockedMode}
                    conversations={sidebarConversations}
                    activeId={activeId}
                    onSelect={(id) => void selectConversation(id)}
                    onNewChat={handleNewChat}
                    onDelete={handleDelete}
                    onRename={handleRename}
                    confirmingDeleteId={confirmingDeleteId}
                    collapsed={sidebarCollapsed}
                    onToggleCollapse={() => {
                        if (sidebarOpenMobile) {
                            setSidebarOpenMobile(false);
                        } else {
                            setSidebarCollapsed((v) => !v);
                        }
                    }}
                    mobileOpen={sidebarOpenMobile}
                />

                <div className={styles.main}>
                    <div className={styles.chatTopBar}>
                        <button
                            type="button"
                            className={styles.topBarIconBtn}
                            onClick={() => setSidebarOpenMobile(true)}
                            aria-label="Open chat history"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M4 6h16" />
                                <path d="M4 12h16" />
                                <path d="M4 18h16" />
                            </svg>
                        </button>
                        {!activeId ? (
                            <span className={styles.topBarTitle}>History & Search</span>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className={styles.backBtn}
                                    onClick={() => setActiveId(null)}
                                    title="Back to history"
                                >
                                    <ArrowLeftIcon />
                                </button>
                                {active && (
                                    <ChatTopBarTitle
                                        conversation={active}
                                        isAuthenticated={viewer.type === "authenticated"}
                                        onRename={renameConversation}
                                        onDelete={handleDelete}
                                        confirmingDeleteId={confirmingDeleteId}
                                        onPin={handlePin}
                                        onArchive={handleArchive}
                                        onExport={handleExport}
                                    />
                                )}
                            </>
                        )}
                    </div>

                    {!activeId ? (
                        <HistoryView
                            conversations={sidebarConversations}
                            activeMode={historyFilter}
                            searchQuery={historySearch}
                            onSearchChange={setHistorySearch}
                            onFilterChange={setHistoryFilter}
                            onSelect={selectConversation}
                            onNewChat={handleNewChat}
                        />
                    ) : (
                        <div className={styles.messages}>
                            <div className={styles.messagesInner}>
                                {showEmptyState ? (
                                    <EmptyState mode={mode} />
                                ) : (
                                    messages.map((m) => (
                                        <MessageBubble
                                            key={m.id}
                                            id={m.id}
                                            role={m.role}
                                            content={m.content}
                                            status={m.status}
                                            imageUrls={m.imageUrls}
                                            conversationTitle={active.title}
                                            isStreaming={
                                                isStreaming &&
                                                ACTIVE_STATUSES.includes(m.status)
                                            }
                                        />
                                    ))
                                )}
                                <div ref={messagesEndRef} aria-hidden />
                            </div>
                        </div>
                    )}

                    <div className={styles.inputArea}>
                        {showQuotaGate && (
                            <AuthGate
                                text={`You've used all ${anonQuota?.limit ?? 3} free Auteur replies.`}
                                ctaLabel="Sign in to continue"
                                ctaHref="/login"
                            />
                        )}
                        {showLowCreditGate && (
                            <AuthGate
                                text="You're out of credits."
                                ctaLabel="Top up"
                                ctaHref="/credits"
                            />
                        )}

                        <AuteurComposer
                            disabled={showQuotaGate || showLowCreditGate}
                            isStreaming={isStreaming}
                            placeholder={MODE_PLACEHOLDER[mode]}
                            onSend={(p) => void handleSend(p)}
                            onStop={handleStop}
                            hint={composerHint}
                            hintAction={composerHintAction}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ mode }: { mode: AuteurMode }) {
    const copy = MODE_EMPTY_STATE[mode];
    return (
        <div className={styles.emptyState}>
            <div className={`${styles.emptyIconWrap} group`}>
                <AuteurIcon
                    size={56}
                    strokeWidth={1.25}
                    eyeStrokeWidth={2}
                    className={styles.emptyIcon}
                />
            </div>
            <h2 className={styles.emptyTitle}>{copy.title}</h2>
            <p className={styles.emptyDesc}>{copy.description}</p>
        </div>
    );
}

// ─── Auth / quota gate ─────────────────────────────────────────────────────

function AuthGate({
    text,
    ctaLabel,
    ctaHref,
}: {
    text: string;
    ctaLabel: string;
    ctaHref: string;
}) {
    return (
        <div className={styles.authGate} role="status">
            <span className={styles.authGateText}>{text}</span>
            <a className={styles.authGateLink} href={ctaHref}>
                {ctaLabel}
            </a>
        </div>
    );
}

// ─── Chat top bar title (with dropdown) ───────────────────────────────────

function ChatTopBarTitle({
    conversation,
    isAuthenticated,
    onRename,
    onDelete,
    confirmingDeleteId,
    onPin,
    onArchive,
    onExport,
}: {
    conversation: ConversationState;
    isAuthenticated: boolean;
    onRename: (id: string, newTitle: string) => void;
    onDelete: (id: string, confirmed?: boolean) => void;
    confirmingDeleteId: string | null;
    onPin: (id: string) => void;
    onArchive: (id: string) => void;
    onExport: () => void;
}) {
    const [isRenaming, setIsRenaming] = React.useState(false);
    const [menuOpen, setMenuOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    async function handleSave(newName: string): Promise<string | null> {
        const trimmed = newName.trim();
        if (!trimmed) return "Title is required";
        if (trimmed === conversation.title) {
            setIsRenaming(false);
            return null;
        }
        try {
            const res = await fetch(
                `/api/auteur/conversations/${conversation.id}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: trimmed }),
                },
            );
            if (!res.ok) throw new Error();
            onRename(conversation.id, trimmed);
            setIsRenaming(false);
            return null;
        } catch {
            return "Failed to rename";
        }
    }

    if (isRenaming) {
        return (
            <div className={styles.topBarTitleWrap} style={{ flex: 1, minWidth: 0, maxWidth: 360 }}>
                <InlineRenameForm
                    initialName={conversation.title}
                    onSave={handleSave}
                    onCancel={() => setIsRenaming(false)}
                    size="sm"
                />
            </div>
        );
    }

    return (
        <div ref={containerRef} className={styles.titleAnchor}>
            <button
                type="button"
                className={styles.titleTrigger}
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={`Conversation: ${conversation.title}`}
            >
                {conversation.title}
                <DotsIcon size={14} className={styles.titleDots} />
            </button>

            {menuOpen && (
                <>
                    <div className={styles.contextBackdrop} onClick={() => setMenuOpen(false)} />
                    <div className={styles.titleMenu}>
                        <button
                            className={styles.contextMenuItem}
                            onClick={() => {
                                setMenuOpen(false);
                                setIsRenaming(true);
                            }}
                        >
                            <EditIcon size={14} />
                            Rename
                        </button>
                        <button
                            className={styles.contextMenuItem}
                            onClick={() => {
                                setMenuOpen(false);
                                onPin(conversation.id);
                            }}
                        >
                            <PinIcon size={14} />
                            {conversation.pinnedAt ? "Unpin" : "Pin"}
                        </button>
                        <button
                            className={confirmingDeleteId === conversation.id ? `${styles.contextMenuItem} ${styles.contextMenuItemDanger}` : styles.contextMenuItem}
                            onClick={() => {
                                if (confirmingDeleteId === conversation.id) {
                                    setMenuOpen(false);
                                    onDelete(conversation.id, true);
                                } else {
                                    onDelete(conversation.id, false);
                                }
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                            {confirmingDeleteId === conversation.id ? "Confirm delete?" : "Delete"}
                        </button>
                        <div className={styles.contextMenuDivider} />
                        <button
                            className={styles.contextMenuItem}
                            onClick={() => {
                                setMenuOpen(false);
                                onExport();
                            }}
                        >
                            <ExportIcon size={14} />
                            Export PDF
                        </button>
                        <button
                            className={styles.contextMenuItem}
                            onClick={() => {
                                setMenuOpen(false);
                                onArchive(conversation.id);
                            }}
                        >
                            <ArchiveIcon size={14} />
                            Archive
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── History View ──────────────────────────────────────────────────────────

function HistoryView({
    conversations,
    activeMode,
    searchQuery,
    onSearchChange,
    onFilterChange,
    onSelect,
    onNewChat,
}: {
    conversations: ConversationState[];
    activeMode: AuteurMode | "all";
    searchQuery: string;
    onSearchChange: (v: string) => void;
    onFilterChange: (m: AuteurMode | "all") => void;
    onSelect: (id: string) => void;
    onNewChat: () => void;
}) {
    const filtered = React.useMemo(() => {
        let list = conversations;
        if (activeMode !== "all") {
            list = list.filter((c) => c.mode === activeMode);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter((c) => c.title.toLowerCase().includes(q));
        }
        return list;
    }, [conversations, activeMode, searchQuery]);

    const isEmpty = filtered.length === 0;

    return (
        <div className={styles.historyView}>
            <div className={styles.historyContainer}>
                <div className={styles.historyControls}>
                    <div className={styles.historyFilterWrap}>
                        <select
                            className={styles.historyFilterSelect}
                            value={activeMode}
                            onChange={(e) => onFilterChange(e.target.value as any)}
                        >
                            <option value="all">All History</option>
                            <option value="chat">Chat</option>
                            <option value="script">Script</option>
                            <option value="storyboard">Storyboard</option>
                        </select>
                        <svg className={styles.filterChevron} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                    </div>

                    <button className={styles.historyNewBtn} onClick={onNewChat}>
                        <PlusIcon size={16} />
                        New Chat
                    </button>
                </div>

                <div className={styles.historyTopRow}>
                    <div className={styles.historySearchWrap}>
                        <SearchIcon className={styles.historySearchIcon} />
                        <input
                            type="text"
                            className={styles.historySearchInput}
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                    </div>
                </div>

                {isEmpty ? (
                    <div className={styles.historyEmpty}>
                        <div className={styles.historyEmptyIcon}>
                            <SearchIcon size={48} />
                        </div>
                        <h3 className={styles.historyEmptyTitle}>No conversations found</h3>
                        <p className={styles.historyEmptyDesc}>
                            {searchQuery ? "Try a different search term or filter." : "Start your first conversation to see it here."}
                        </p>
                    </div>
                ) : (
                    <div className={styles.historyScroll}>
                        <h4 className={styles.historyHeading}>Recent</h4>
                        {filtered.map((c) => (
                            <button
                                key={c.id}
                                className={styles.historyItem}
                                onClick={() => onSelect(c.id)}
                            >
                                <div className={styles.historyItemContent}>
                                    <span className={styles.historyItemTitle}>{c.title}</span>
                                </div>
                                <span className={styles.historyItemMeta}>
                                    {new Date(c.updatedAt).toLocaleDateString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                    })}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}


// ─── SSE parsing (CRLF-tolerant) ────────────────────────────────────────────

type SseEvent =
    | {
          type: "message";
          user: {
              id: string;
              role: "user";
              content: string;
              imageUrls: string[];
              createdAt: number;
              status: MessageStatus;
          };
          assistant: {
              id: string;
              role: "assistant";
              content: string;
              createdAt: number;
              status: MessageStatus;
          };
      }
    | { type: "token"; delta: string }
    | { type: "title"; title: string }
    | {
          type: "done";
          reason: "complete" | "stopped";
          balance?: { totalCredits: number; plan: string } | null;
          quota?: AnonQuota | null;
      }
    | { type: "error"; message: string };

async function consumeSseStream(
    body: ReadableStream<Uint8Array>,
    handlers: { onEvent: (event: SseEvent) => void },
): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) buffer += decoder.decode(value, { stream: true });
            let boundary = findEventBoundary(buffer);
            while (boundary !== null) {
                const rawEvent = buffer.slice(0, boundary.index);
                buffer = buffer.slice(boundary.index + boundary.length);
                const parsed = parseSseFrame(rawEvent);
                if (parsed) handlers.onEvent(parsed);
                boundary = findEventBoundary(buffer);
            }
        }
        buffer += decoder.decode();
        if (buffer.trim().length > 0) {
            const parsed = parseSseFrame(buffer);
            if (parsed) handlers.onEvent(parsed);
        }
    } finally {
        try {
            reader.releaseLock();
        } catch {
            // Already released.
        }
    }
}

function findEventBoundary(
    buffer: string,
): { index: number; length: number } | null {
    const crlf = buffer.indexOf("\r\n\r\n");
    const lf = buffer.indexOf("\n\n");
    if (crlf === -1 && lf === -1) return null;
    if (crlf !== -1 && (lf === -1 || crlf <= lf)) {
        return { index: crlf, length: 4 };
    }
    return { index: lf, length: 2 };
}

function parseSseFrame(frame: string): SseEvent | null {
    const dataLines: string[] = [];
    for (const raw of frame.split("\n")) {
        const line = raw.replace(/\r$/, "");
        if (line.startsWith("data: ")) dataLines.push(line.slice(6));
        else if (line.startsWith("data:")) dataLines.push(line.slice(5));
    }
    if (dataLines.length === 0) return null;
    const payload = dataLines.join("\n").trim();
    if (!payload) return null;
    try {
        return JSON.parse(payload) as SseEvent;
    } catch {
        return null;
    }
}
