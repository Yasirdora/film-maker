"use client";

/**
 * Storyboard workspace store — single source of truth for the client.
 *
 * Holds the full board shape and exposes optimistic mutations that
 * apply locally first, then fire the API call, and roll back on
 * failure. All UI interactions go through this store; no component
 * fetches directly. This is what makes the surface feel instant — a
 * drag-reorder lays the new order down immediately, then the server
 * confirms it asynchronously.
 *
 * Errors surface via `toast.error`. We don't reload from the server on
 * every failure; the rollback is enough because the optimistic state
 * already matches the server's pre-mutation state.
 */

import { create } from "zustand";
import { toast } from "sonner";

import type {
    Scene,
    Shot,
    StoryboardBoard,
} from "@/lib/storyboards";

// ─── Types ─────────────────────────────────────────────────────────────────

interface State {
    storyboardUid: string;
    title: string;
    scenes: Scene[];
}

interface Actions {
    /** Replace the entire board — used by the page bootstrap. */
    bootstrap: (board: StoryboardBoard) => void;

    // ─── Storyboard ────────────────────────────────────────────────
    renameStoryboard: (title: string) => Promise<void>;

    // ─── Scenes ────────────────────────────────────────────────────
    addScene: () => Promise<Scene | null>;
    updateScene: (
        sceneUid: string,
        input: { slugline?: string | null; action?: string | null; notes?: string | null },
    ) => Promise<void>;
    deleteScene: (sceneUid: string) => Promise<void>;
    reorderScenes: (orderedSceneUids: string[]) => Promise<void>;

    // ─── Shots ─────────────────────────────────────────────────────
    addShot: (sceneUid: string) => Promise<Shot | null>;
    updateShot: (
        shotUid: string,
        input: Partial<{
            prompt: string | null;
            action: string | null;
            dialogue: string | null;
            notes: string | null;
            shotType: string | null;
            cameraMove: string | null;
            transition: string | null;
            durationMs: number;
        }>,
    ) => Promise<void>;
    deleteShot: (shotUid: string) => Promise<void>;
    /**
     * Move/reorder shots into `targetSceneUid`. `orderedShotUids` is the
     * destination's full new ordering. Supports cross-scene moves.
     */
    reorderShots: (
        targetSceneUid: string,
        orderedShotUids: string[],
    ) => Promise<void>;
}

export type StoryboardStore = State & Actions;

// ─── HTTP helper ───────────────────────────────────────────────────────────
//
// All mutations share the same shape: `fetch` → JSON. On non-2xx we throw a
// typed error so the optimistic handlers below can roll back uniformly.

class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = "ApiError";
    }
}

async function api<T = unknown>(
    method: "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown,
): Promise<T> {
    const res = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        let message = `${method} ${path} failed (${res.status})`;
        try {
            const data = (await res.json()) as { error?: string };
            if (typeof data.error === "string") message = data.error;
        } catch {
            // body wasn't JSON — keep the generic message
        }
        throw new ApiError(res.status, message);
    }
    // 204-style endpoints still return `{ ok: true }`, so always parse.
    return (await res.json()) as T;
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const createStoryboardStore = (initial: StoryboardBoard) =>
    create<StoryboardStore>((set, get) => ({
        storyboardUid: initial.storyboard.uid,
        title: initial.storyboard.title,
        scenes: initial.scenes,

        bootstrap: (board) =>
            set({
                storyboardUid: board.storyboard.uid,
                title: board.storyboard.title,
                scenes: board.scenes,
            }),

        // ─── Storyboard ────────────────────────────────────────────
        renameStoryboard: async (rawTitle) => {
            const title = rawTitle.trim();
            if (!title) return;
            const prev = get().title;
            set({ title });
            try {
                await api("PATCH", `/api/storyboards/${get().storyboardUid}`, {
                    title,
                });
            } catch (err) {
                set({ title: prev });
                toast.error(err instanceof Error ? err.message : "Rename failed");
            }
        },

        // ─── Scenes ────────────────────────────────────────────────
        addScene: async () => {
            try {
                const { scene } = await api<{ scene: Scene }>(
                    "POST",
                    `/api/storyboards/${get().storyboardUid}/scenes`,
                );
                set((s) => ({ scenes: [...s.scenes, scene] }));
                return scene;
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Add scene failed");
                return null;
            }
        },

        updateScene: async (sceneUid, input) => {
            const prev = get().scenes;
            set((s) => ({
                scenes: s.scenes.map((sc) =>
                    sc.uid === sceneUid ? { ...sc, ...input } : sc,
                ),
            }));
            try {
                await api("PATCH", `/api/storyboards/scenes/${sceneUid}`, input);
            } catch (err) {
                set({ scenes: prev });
                toast.error(err instanceof Error ? err.message : "Update failed");
            }
        },

        deleteScene: async (sceneUid) => {
            const prev = get().scenes;
            set((s) => ({
                scenes: s.scenes.filter((sc) => sc.uid !== sceneUid),
            }));
            try {
                await api("DELETE", `/api/storyboards/scenes/${sceneUid}`);
            } catch (err) {
                set({ scenes: prev });
                toast.error(err instanceof Error ? err.message : "Delete failed");
            }
        },

        reorderScenes: async (orderedSceneUids) => {
            const prev = get().scenes;
            const byUid = new Map(prev.map((s) => [s.uid, s]));
            const next = orderedSceneUids
                .map((uid) => byUid.get(uid))
                .filter((s): s is Scene => s !== undefined);
            // Preserve any scenes the caller forgot to include (defensive).
            for (const s of prev) {
                if (!orderedSceneUids.includes(s.uid)) next.push(s);
            }
            set({ scenes: next });
            try {
                await api(
                    "POST",
                    `/api/storyboards/${get().storyboardUid}/reorder`,
                    { sceneUids: orderedSceneUids },
                );
            } catch (err) {
                set({ scenes: prev });
                toast.error(err instanceof Error ? err.message : "Reorder failed");
            }
        },

        // ─── Shots ─────────────────────────────────────────────────
        addShot: async (sceneUid) => {
            try {
                const { shot } = await api<{ shot: Shot }>(
                    "POST",
                    `/api/storyboards/scenes/${sceneUid}/shots`,
                );
                set((s) => ({
                    scenes: s.scenes.map((sc) =>
                        sc.uid === sceneUid
                            ? { ...sc, shots: [...sc.shots, shot] }
                            : sc,
                    ),
                }));
                return shot;
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Add shot failed");
                return null;
            }
        },

        updateShot: async (shotUid, input) => {
            const prev = get().scenes;
            set((s) => ({
                scenes: s.scenes.map((sc) => ({
                    ...sc,
                    shots: sc.shots.map((sh) =>
                        sh.uid === shotUid ? { ...sh, ...input } : sh,
                    ),
                })),
            }));
            try {
                await api("PATCH", `/api/storyboards/shots/${shotUid}`, input);
            } catch (err) {
                set({ scenes: prev });
                toast.error(err instanceof Error ? err.message : "Update failed");
            }
        },

        deleteShot: async (shotUid) => {
            const prev = get().scenes;
            set((s) => ({
                scenes: s.scenes.map((sc) => ({
                    ...sc,
                    shots: sc.shots.filter((sh) => sh.uid !== shotUid),
                })),
            }));
            try {
                await api("DELETE", `/api/storyboards/shots/${shotUid}`);
            } catch (err) {
                set({ scenes: prev });
                toast.error(err instanceof Error ? err.message : "Delete failed");
            }
        },

        reorderShots: async (targetSceneUid, orderedShotUids) => {
            const prev = get().scenes;

            // Apply optimistically: every supplied shot ends up in the
            // target scene in the given order; sources lose them. We
            // build a flat shot map keyed by uid, then rebuild each
            // scene's shot list from that map.
            const shotByUid = new Map<string, Shot>();
            for (const sc of prev) {
                for (const sh of sc.shots) shotByUid.set(sh.uid, sh);
            }

            const targetShots: Shot[] = [];
            const targetUidSet = new Set(orderedShotUids);
            for (const uid of orderedShotUids) {
                const sh = shotByUid.get(uid);
                if (sh) targetShots.push({ ...sh, sceneUid: targetSceneUid });
            }

            const next = prev.map((sc) => {
                if (sc.uid === targetSceneUid) {
                    return { ...sc, shots: targetShots };
                }
                // Remove any moved-out shots from source scenes; keep the
                // rest in their current relative order.
                return {
                    ...sc,
                    shots: sc.shots.filter((sh) => !targetUidSet.has(sh.uid)),
                };
            });
            set({ scenes: next });

            try {
                await api(
                    "POST",
                    `/api/storyboards/scenes/${targetSceneUid}/reorder`,
                    { shotUids: orderedShotUids },
                );
            } catch (err) {
                set({ scenes: prev });
                toast.error(err instanceof Error ? err.message : "Reorder failed");
            }
        },
    }));
