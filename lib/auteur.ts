/**
 * Auteur chat — server-only data access.
 *
 * Wraps the `auteur_conversation`, `auteur_message`, and
 * `auteur_anon_quota` tables. Every mutation verifies caller access
 * via {@link requireConversationAccess} before touching rows:
 *
 *   • Authenticated users own rows via `user_id`.
 *   • Anonymous visitors own rows via a per-conversation `anon_token`
 *     that the client holds in localStorage. Even a leaked conversation
 *     id is useless without the matching token.
 *
 * Claim flow: after sign-up the client POSTs the (id, token) pairs of
 * anonymous conversations it created. Rows whose token matches are
 * migrated to the new user; mismatched rows are silently ignored so
 * no-one can claim someone else's threads.
 *
 * The free-response cap for signed-out visitors is enforced by the
 * `auteur_anon_quota` counter, keyed on a cookie value (`fm_anon_id`).
 * IP is captured for abuse audits but is not the quota key — CGNAT
 * would block legitimate users if it were.
 */

import { getDb } from "./db";
import { generateUid } from "./utils";
import { isFreePlan } from "./constants";

// ─── Modes ──────────────────────────────────────────────────────────────────

export const AUTEUR_MODES = ["chat", "script", "storyboard"] as const;
export type AuteurMode = (typeof AUTEUR_MODES)[number];

export function isAuteurMode(value: unknown): value is AuteurMode {
    return (
        typeof value === "string" &&
        (AUTEUR_MODES as readonly string[]).includes(value)
    );
}

/**
 * Modes available on a given plan.
 *
 *   Solo (and anon): `chat` only.
 *   Paid tiers:      all four modes.
 *
 * Paid tiers aren't currently sellable (see PAID_PLANS_ENABLED), so in
 * practice every signed-in user today is gated to `chat`. The check is
 * still plan-based so the gate flips automatically the day paid plans
 * open up.
 */
export function isModeAllowedForPlan(mode: AuteurMode, planId: string): boolean {
    if (mode === "chat") return true;
    return !isFreePlan(planId);
}

// ─── Tunables ───────────────────────────────────────────────────────────────

export const MAX_MESSAGE_LENGTH = 10_000;
export const MAX_CONVERSATION_TITLE_LENGTH = 120;
export const MAX_IMAGE_ATTACHMENTS_PER_MESSAGE = 4;

/** Free responses allowed before an anonymous visitor must sign in. */
export const ANON_FREE_RESPONSES = 3;

/** Placeholder shown while the LLM generates the real conversation title. */
export const PLACEHOLDER_TITLE = "Drafting…";

/** Credits deducted per completed assistant response on the Solo plan. */
export const SOLO_CHAT_CREDIT_COST = 1;

// ─── Types ──────────────────────────────────────────────────────────────────

export type MessageStatus =
    | "pending"
    | "streaming"
    | "complete"
    | "failed"
    | "stopped";

export interface ConversationRow {
    id: string;
    userId: string | null;
    anonToken: string | null;
    title: string;
    mode: AuteurMode;
    projectId: number | null;
    pinnedAt: number | null;
    archivedAt: number | null;
    createdAt: number;
    updatedAt: number;
}

export interface ConversationSummary {
    id: string;
    title: string;
    mode: AuteurMode;
    pinnedAt: number | null;
    archivedAt: number | null;
    updatedAt: number;
}

export interface MessageRow {
    id: string;
    conversationId: string;
    role: "user" | "assistant";
    content: string;
    status: MessageStatus;
    imageR2Keys: string[] | null;
    createdAt: number;
}

interface RawConversation {
    id: string;
    user_id: string | null;
    anon_token: string | null;
    title: string;
    mode: string;
    project_id: number | null;
    pinned_at: number | null;
    archived_at: number | null;
    created_at: number;
    updated_at: number;
}

interface RawMessage {
    id: string;
    conversation_id: string;
    role: string;
    content: string;
    status: string;
    image_r2_keys: string | null;
    created_at: number;
}

function mapConversation(r: RawConversation): ConversationRow {
    return {
        id: r.id,
        userId: r.user_id,
        anonToken: r.anon_token,
        title: r.title,
        mode: isAuteurMode(r.mode) ? r.mode : "chat",
        projectId: r.project_id,
        pinnedAt: r.pinned_at,
        archivedAt: r.archived_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

function mapMessage(r: RawMessage): MessageRow {
    return {
        id: r.id,
        conversationId: r.conversation_id,
        role: r.role === "assistant" ? "assistant" : "user",
        content: r.content,
        status: (["pending", "streaming", "complete", "failed", "stopped"] as const)
            .find((s) => s === r.status) ?? "complete",
        imageR2Keys: r.image_r2_keys ? (JSON.parse(r.image_r2_keys) as string[]) : null,
        createdAt: r.created_at,
    };
}

// ─── Anon tokens ────────────────────────────────────────────────────────────

/**
 * Cryptographic per-conversation token. 32 random bytes as hex → ~256 bits.
 * The client stores this alongside the conversation id in localStorage and
 * presents it on every read/write for anonymous threads.
 */
function generateAnonToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Access control ─────────────────────────────────────────────────────────

export class ConversationAccessError extends Error {
    constructor() {
        super("Conversation not found or access denied");
        this.name = "ConversationAccessError";
    }
}

/**
 * Returns the conversation iff the caller owns it. Throws
 * {@link ConversationAccessError} otherwise — the error message is
 * deliberately vague (doesn't distinguish not-found from forbidden) so
 * the endpoint doesn't leak conversation-id existence.
 */
export async function requireConversationAccess(params: {
    conversationId: string;
    userId: string | null;
    anonToken?: string | null;
}): Promise<ConversationRow> {
    const { conversationId, userId, anonToken } = params;
    const db = await getDb();

    const raw = await db
        .prepare(
            `SELECT id, user_id, anon_token, title, mode, project_id,
                    pinned_at, archived_at, created_at, updated_at
               FROM auteur_conversation
              WHERE id = ?
              LIMIT 1`,
        )
        .bind(conversationId)
        .first<RawConversation>();

    if (!raw) throw new ConversationAccessError();

    const ownsAsUser = userId !== null && raw.user_id === userId;
    const ownsAsAnon =
        raw.user_id === null &&
        raw.anon_token !== null &&
        typeof anonToken === "string" &&
        anonToken.length > 0 &&
        raw.anon_token === anonToken;

    if (!ownsAsUser && !ownsAsAnon) throw new ConversationAccessError();

    return mapConversation(raw);
}

// ─── Conversation CRUD ──────────────────────────────────────────────────────

export async function createConversation(params: {
    userId: string | null;
    mode: AuteurMode;
    projectId?: number | null;
    title?: string;
}): Promise<{ conversation: ConversationRow; anonToken: string | null }> {
    const db = await getDb();
    const now = Date.now();
    const id = crypto.randomUUID();
    const anonToken = params.userId ? null : generateAnonToken();
    const title = (params.title ?? PLACEHOLDER_TITLE).slice(
        0,
        MAX_CONVERSATION_TITLE_LENGTH,
    );

    await db
        .prepare(
            `INSERT INTO auteur_conversation
             (id, user_id, anon_token, title, mode, project_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
            id,
            params.userId,
            anonToken,
            title,
            params.mode,
            params.projectId ?? null,
            now,
            now,
        )
        .run();

    return {
        conversation: {
            id,
            userId: params.userId,
            anonToken,
            title,
            mode: params.mode,
            projectId: params.projectId ?? null,
            pinnedAt: null,
            archivedAt: null,
            createdAt: now,
            updatedAt: now,
        },
        anonToken,
    };
}

/** Lists a user's conversations, pinned first then newest-first. */
export async function listUserConversations(
    userId: string,
    options: { includeArchived?: boolean; limit?: number } = {},
): Promise<ConversationSummary[]> {
    const db = await getDb();
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

    const { results } = await db
        .prepare(
            `SELECT id, title, mode, pinned_at, archived_at, updated_at
               FROM auteur_conversation
              WHERE user_id = ?
                ${options.includeArchived ? "" : "AND archived_at IS NULL"}
              ORDER BY
                  CASE WHEN pinned_at IS NULL THEN 1 ELSE 0 END,
                  pinned_at DESC,
                  updated_at DESC
              LIMIT ?`,
        )
        .bind(userId, limit)
        .all<{
            id: string;
            title: string;
            mode: string;
            pinned_at: number | null;
            archived_at: number | null;
            updated_at: number;
        }>();

    return results.map((r) => ({
        id: r.id,
        title: r.title,
        mode: isAuteurMode(r.mode) ? r.mode : "chat",
        pinnedAt: r.pinned_at,
        archivedAt: r.archived_at,
        updatedAt: r.updated_at,
    }));
}

export async function renameConversation(params: {
    conversationId: string;
    userId: string;
    title: string;
}): Promise<void> {
    const trimmed = params.title.trim();
    if (trimmed.length === 0) throw new Error("Title cannot be empty");

    await requireConversationAccess({
        conversationId: params.conversationId,
        userId: params.userId,
    });

    const db = await getDb();
    await db
        .prepare(
            `UPDATE auteur_conversation
                SET title = ?, updated_at = ?
              WHERE id = ?`,
        )
        .bind(
            trimmed.slice(0, MAX_CONVERSATION_TITLE_LENGTH),
            Date.now(),
            params.conversationId,
        )
        .run();
}

export async function setConversationPinned(params: {
    conversationId: string;
    userId: string;
    pinned: boolean;
}): Promise<void> {
    await requireConversationAccess({
        conversationId: params.conversationId,
        userId: params.userId,
    });

    const db = await getDb();
    await db
        .prepare(
            `UPDATE auteur_conversation
                SET pinned_at = ?, updated_at = ?
              WHERE id = ?`,
        )
        .bind(
            params.pinned ? Date.now() : null,
            Date.now(),
            params.conversationId,
        )
        .run();
}

export async function setConversationArchived(params: {
    conversationId: string;
    userId: string;
    archived: boolean;
}): Promise<void> {
    await requireConversationAccess({
        conversationId: params.conversationId,
        userId: params.userId,
    });

    const db = await getDb();
    await db
        .prepare(
            `UPDATE auteur_conversation
                SET archived_at = ?, updated_at = ?
              WHERE id = ?`,
        )
        .bind(
            params.archived ? Date.now() : null,
            Date.now(),
            params.conversationId,
        )
        .run();
}


export async function deleteConversation(params: {
    conversationId: string;
    userId: string;
}): Promise<void> {
    await requireConversationAccess({
        conversationId: params.conversationId,
        userId: params.userId,
    });

    const db = await getDb();
    // ON DELETE CASCADE on auteur_message FK removes messages too.
    await db
        .prepare(`DELETE FROM auteur_conversation WHERE id = ?`)
        .bind(params.conversationId)
        .run();
}

/**
 * Updates the conversation title — used after the first LLM response to
 * replace the placeholder. Internal (no access check) because only server
 * code calls it, immediately after a successful access-checked insert.
 */
export async function updateConversationTitleInternal(
    conversationId: string,
    title: string,
): Promise<void> {
    const db = await getDb();
    await db
        .prepare(
            `UPDATE auteur_conversation
                SET title = ?, updated_at = ?
              WHERE id = ?`,
        )
        .bind(
            title.slice(0, MAX_CONVERSATION_TITLE_LENGTH),
            Date.now(),
            conversationId,
        )
        .run();
}

export async function touchConversation(conversationId: string): Promise<void> {
    const db = await getDb();
    await db
        .prepare(
            `UPDATE auteur_conversation SET updated_at = ? WHERE id = ?`,
        )
        .bind(Date.now(), conversationId)
        .run();
}

// ─── Claim on sign-up ───────────────────────────────────────────────────────

/**
 * Migrates anonymous conversations to a signed-in user. Each claim must
 * include the exact token that was handed to the client at creation
 * time; rows without a matching token are silently skipped. Returns the
 * count of rows successfully claimed.
 */
export async function claimAnonymousConversations(params: {
    userId: string;
    claims: Array<{ conversationId: string; anonToken: string }>;
}): Promise<number> {
    if (params.claims.length === 0) return 0;

    const db = await getDb();
    const now = Date.now();
    let claimed = 0;

    // Each claim runs as its own UPDATE with both id and anon_token in
    // the WHERE — a forged token or hijacked id simply matches zero rows.
    for (const { conversationId, anonToken } of params.claims) {
        const result = await db
            .prepare(
                `UPDATE auteur_conversation
                    SET user_id = ?, anon_token = NULL, updated_at = ?
                  WHERE id = ?
                    AND user_id IS NULL
                    AND anon_token = ?`,
            )
            .bind(params.userId, now, conversationId, anonToken)
            .run();

        if ((result.meta?.changes ?? 0) > 0) claimed += 1;
    }

    return claimed;
}

// ─── Message CRUD ───────────────────────────────────────────────────────────

/**
 * Default cap on the number of messages returned. Sending an unbounded
 * conversation to Gemini risks hitting its context-window token limit and
 * causes request failures for long threads. 100 messages is a safe upper
 * bound that covers virtually all real conversations while staying well
 * within the 1M-token context window.
 */
const DEFAULT_MESSAGE_LIMIT = 100;

/**
 * Returns the most recent `limit` messages for a conversation in
 * chronological order (oldest first, so the LLM sees the natural
 * dialogue sequence). Uses a subquery to efficiently select the LAST N
 * messages rather than the first N.
 */
export async function listMessages(
    conversationId: string,
    limit = DEFAULT_MESSAGE_LIMIT,
): Promise<MessageRow[]> {
    const db = await getDb();
    // Inner query gets the most recent `limit` rows (newest first);
    // outer query re-orders them chronologically for the LLM.
    const { results } = await db
        .prepare(
            `SELECT id, conversation_id, role, content, status, image_r2_keys, created_at
               FROM (
                   SELECT id, conversation_id, role, content, status, image_r2_keys, created_at
                     FROM auteur_message
                    WHERE conversation_id = ?
                    ORDER BY created_at DESC, id DESC
                    LIMIT ?
               )
               ORDER BY created_at ASC, id ASC`,
        )
        .bind(conversationId, limit)
        .all<RawMessage>();

    return results.map(mapMessage);
}

export async function insertUserMessage(params: {
    conversationId: string;
    content: string;
    imageR2Keys: string[] | null;
}): Promise<MessageRow> {
    const db = await getDb();
    const now = Date.now();
    const id = crypto.randomUUID();

    await db
        .prepare(
            `INSERT INTO auteur_message
             (id, conversation_id, role, content, status, image_r2_keys, created_at)
             VALUES (?, ?, 'user', ?, 'complete', ?, ?)`,
        )
        .bind(
            id,
            params.conversationId,
            params.content,
            params.imageR2Keys ? JSON.stringify(params.imageR2Keys) : null,
            now,
        )
        .run();

    return {
        id,
        conversationId: params.conversationId,
        role: "user",
        content: params.content,
        status: "complete",
        imageR2Keys: params.imageR2Keys,
        createdAt: now,
    };
}

export async function insertAssistantPlaceholder(params: {
    conversationId: string;
    createdAt?: number;
}): Promise<MessageRow> {
    const db = await getDb();
    // +1ms so ordering-by-createdAt puts the placeholder after the user msg
    // even if they land in the same millisecond.
    const now = params.createdAt ?? Date.now() + 1;
    const id = crypto.randomUUID();

    await db
        .prepare(
            `INSERT INTO auteur_message
             (id, conversation_id, role, content, status, image_r2_keys, created_at)
             VALUES (?, ?, 'assistant', '', 'pending', NULL, ?)`,
        )
        .bind(id, params.conversationId, now)
        .run();

    return {
        id,
        conversationId: params.conversationId,
        role: "assistant",
        content: "",
        status: "pending",
        imageR2Keys: null,
        createdAt: now,
    };
}

export async function updateAssistantMessage(params: {
    messageId: string;
    content: string;
    status: MessageStatus;
}): Promise<void> {
    const db = await getDb();
    // Don't overwrite a user-initiated 'stopped' with a late completion.
    const current = await db
        .prepare(`SELECT status FROM auteur_message WHERE id = ?`)
        .bind(params.messageId)
        .first<{ status: string }>();

    if (current?.status === "stopped") return;

    await db
        .prepare(
            `UPDATE auteur_message SET content = ?, status = ? WHERE id = ?`,
        )
        .bind(params.content, params.status, params.messageId)
        .run();
}

export async function markAssistantStopped(params: {
    conversationId: string;
    userId: string | null;
    anonToken?: string | null;
}): Promise<void> {
    await requireConversationAccess({
        conversationId: params.conversationId,
        userId: params.userId,
        anonToken: params.anonToken,
    });

    const db = await getDb();
    // Newest pending/streaming assistant message wins — the one the user
    // is currently watching.
    await db
        .prepare(
            `UPDATE auteur_message
                SET status = 'stopped'
              WHERE id = (
                SELECT id FROM auteur_message
                 WHERE conversation_id = ?
                   AND role = 'assistant'
                   AND status IN ('pending', 'streaming')
                 ORDER BY created_at DESC
                 LIMIT 1
              )`,
        )
        .bind(params.conversationId)
        .run();
}

// ─── Anon quota ─────────────────────────────────────────────────────────────

export interface AnonQuotaStatus {
    used: number;
    remaining: number;
    limit: number;
}

export async function getAnonQuota(anonId: string): Promise<AnonQuotaStatus> {
    const db = await getDb();
    const row = await db
        .prepare(
            `SELECT responses_used FROM auteur_anon_quota WHERE anon_id = ?`,
        )
        .bind(anonId)
        .first<{ responses_used: number }>();

    const used = row?.responses_used ?? 0;
    return {
        used,
        remaining: Math.max(0, ANON_FREE_RESPONSES - used),
        limit: ANON_FREE_RESPONSES,
    };
}

/**
 * Atomically increments the anon quota counter. Throws
 * {@link AnonQuotaExceededError} when the counter has already reached
 * {@link ANON_FREE_RESPONSES}.
 *
 * The entire check-and-increment is a single SQL statement: the UPSERT's
 * DO UPDATE clause only fires when `responses_used < ANON_FREE_RESPONSES`.
 * If it doesn't fire (changes === 0), the quota is exhausted. This closes
 * the TOCTOU window that would exist with a separate SELECT + UPDATE pair.
 */
export async function consumeAnonQuota(params: {
    anonId: string;
    ip: string | null;
}): Promise<AnonQuotaStatus> {
    const db = await getDb();
    const now = Date.now();

    // Attempt to insert (first use) or conditionally increment (repeat use).
    // The WHERE on DO UPDATE prevents the increment when already at the limit,
    // causing meta.changes to be 0 on both the INSERT (conflict) and UPDATE
    // (WHERE false) paths — which we interpret as quota exceeded.
    const result = await db
        .prepare(
            `INSERT INTO auteur_anon_quota
             (anon_id, responses_used, first_ip, created_at, updated_at)
             VALUES (?, 1, ?, ?, ?)
             ON CONFLICT(anon_id) DO UPDATE SET
                 responses_used = auteur_anon_quota.responses_used + 1,
                 updated_at     = excluded.updated_at
             WHERE auteur_anon_quota.responses_used < ?`,
        )
        .bind(params.anonId, params.ip, now, now, ANON_FREE_RESPONSES)
        .run();

    if ((result.meta?.changes ?? 0) === 0) {
        throw new AnonQuotaExceededError(
            `You've used your ${ANON_FREE_RESPONSES} free Auteur replies. Sign in to continue.`,
        );
    }

    // Read back the authoritative value so the response is accurate even
    // under concurrent requests.
    const row = await db
        .prepare(
            `SELECT responses_used FROM auteur_anon_quota WHERE anon_id = ?`,
        )
        .bind(params.anonId)
        .first<{ responses_used: number }>();

    const used = row?.responses_used ?? 1;
    return {
        used,
        remaining: Math.max(0, ANON_FREE_RESPONSES - used),
        limit: ANON_FREE_RESPONSES,
    };
}

export class AnonQuotaExceededError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AnonQuotaExceededError";
    }
}
