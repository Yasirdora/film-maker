/**
 * Artistic Intelligence — client-only helpers.
 *
 * Anonymous visitors can't be remembered server-side by anything other
 * than the `fm_anon_id` cookie, so the conversation ownership tokens
 * handed back at creation time live in localStorage under
 * `fm_artistic_intelligence_anon`. The shape is a plain id → token map:
 *
 *   {
 *     "a1b2c3": "deadbeef…",
 *     "d4e5f6": "cafebabe…"
 *   }
 *
 * When the user signs in we POST every (id, token) pair to
 * /api/artistic-intelligence/conversations/claim; successfully-claimed rows are
 * removed from local storage so subsequent sessions don't try to
 * re-claim them.
 */

const STORAGE_KEY = "fm_artistic_intelligence_anon";

export type AnonTokenMap = Record<string, string>;

function safeReadStorage(): AnonTokenMap {
    if (typeof window === "undefined") return {};
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
            return parsed as AnonTokenMap;
        }
        return {};
    } catch {
        return {};
    }
}

function safeWriteStorage(map: AnonTokenMap): void {
    if (typeof window === "undefined") return;
    try {
        if (Object.keys(map).length === 0) {
            window.localStorage.removeItem(STORAGE_KEY);
        } else {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
        }
    } catch {
        // Quota full, private mode, etc — silently drop.
    }
}

export function readAnonTokens(): AnonTokenMap {
    return safeReadStorage();
}

export function rememberAnonToken(conversationId: string, token: string): void {
    const map = safeReadStorage();
    map[conversationId] = token;
    safeWriteStorage(map);
}

export function forgetAnonToken(conversationId: string): void {
    const map = safeReadStorage();
    if (conversationId in map) {
        delete map[conversationId];
        safeWriteStorage(map);
    }
}

export function getAnonToken(conversationId: string): string | null {
    const map = safeReadStorage();
    return map[conversationId] ?? null;
}

export function clearAnonTokens(): void {
    safeWriteStorage({});
}
