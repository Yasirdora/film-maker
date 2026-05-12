"use client";

/**
 * last-export — session-scoped cache of the most recent render per kind.
 *
 * Why this exists
 * ---------------
 * Without a cache, the export dialog re-renders the project from scratch
 * every time the user clicks "Export" in the PageBar. For a multi-minute
 * timeline that's both slow and wasteful — the user almost certainly
 * wanted to see the version they just rendered, not re-render the same
 * frames.
 *
 * Storage model
 * -------------
 * The cache is module-level state, scoped to the current page load. A
 * page reload clears it (the underlying blob URLs would be invalid after
 * reload anyway, so persisting across sessions would require uploading
 * to R2 — out of scope here).
 *
 * The state is a small `{ video, audio }` record because the editor has
 * exactly two export flows. Adding a kind (e.g. "image-sequence") is a
 * one-line extension.
 *
 * Subscriber model
 * ----------------
 * `useLastExport(kind)` reads via `useSyncExternalStore` so React reads
 * the latest value at render time and re-renders consumers when the
 * cache changes. Component code never touches the module-level state
 * directly — read via the hook, write via `setLastExport` /
 * `clearLastExport`.
 *
 * Lifetime
 * --------
 * Each `setLastExport` revokes the previous blob URL for the same kind,
 * so memory stays bounded by O(1) blobs in flight. Callers that want to
 * keep an older URL alive (e.g. mid-download) must do their own
 * snapshotting — the cache only holds the latest.
 */

import { useSyncExternalStore } from "react";

export type ExportKind = "video" | "audio";

export type LastExportSnapshot = {
    /** Object-URL pointing at the rendered Blob. Survives until the next
     *  `setLastExport` for the same kind or an explicit `clearLastExport`. */
    url: string;
    /** Size in bytes — used for the result-panel summary. */
    size: number;
    /** File extension WITHOUT the leading dot (e.g. "mp3", "mp4"). */
    ext: string;
    /** Wall-clock timestamp of the render. Used to label the cached
     *  result so the user can tell "this is from 2 minutes ago". */
    createdAt: number;
};

/* ─── Module-level state ──────────────────────────────────────────────── */

const state: Record<ExportKind, LastExportSnapshot | null> = {
    video: null,
    audio: null,
};

const listeners = new Set<() => void>();

function emit(): void {
    listeners.forEach((cb) => cb());
}

function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}

/* ─── Public API ─────────────────────────────────────────────────────── */

/** Returns the current cached snapshot for the given kind, or null. */
export function getLastExport(kind: ExportKind): LastExportSnapshot | null {
    return state[kind];
}

/**
 * Replaces the cached snapshot for the given kind. The previous URL (if
 * any) is revoked so the underlying Blob can be garbage-collected.
 * `createdAt` is stamped automatically.
 */
export function setLastExport(
    kind: ExportKind,
    next: Omit<LastExportSnapshot, "createdAt">,
): void {
    const prev = state[kind];
    if (prev && prev.url !== next.url) URL.revokeObjectURL(prev.url);
    state[kind] = { ...next, createdAt: Date.now() };
    emit();
}

/**
 * Drops the cached snapshot for the given kind and revokes its URL. Used
 * when the user explicitly discards a render (rare in practice — the
 * cache is normally overwritten by the next render).
 */
export function clearLastExport(kind: ExportKind): void {
    const prev = state[kind];
    if (!prev) return;
    URL.revokeObjectURL(prev.url);
    state[kind] = null;
    emit();
}

/**
 * Hook that subscribes the calling component to changes for one kind.
 * Server-render returns null so SSR markup is deterministic; the cache
 * only ever holds client-side blob URLs anyway.
 */
export function useLastExport(kind: ExportKind): LastExportSnapshot | null {
    return useSyncExternalStore(
        subscribe,
        () => state[kind],
        () => null,
    );
}
