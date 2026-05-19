"use client";

/**
 * useEditorChunk — watches a dynamic-import promise and drives both the
 * boot-loader phase and a recovery path if the chunk fails to load.
 *
 * Why this exists
 * ---------------
 * Every editor route mounts via `next/dynamic` AND separately re-invokes
 * the same import so it can feed `useBootLoader` with a ready signal.
 * Without proper error handling, a network failure (CDN miss, deploy
 * mid-rollout, offline) leaves the boot loader pulsing forever with no
 * way out — the user sees a spinner indefinitely.
 *
 * This hook centralises the pattern: callers pass the same module
 * loader they handed to `dynamic()`, and the hook reports either a
 * `LoaderPhase` (success path) or an `Error` (failure path). The mount
 * decides what to render in each case — typically the editor itself
 * while loading/loaded, and an error card with a retry/reload action
 * on failure.
 *
 * Module-cached imports
 * ---------------------
 * `import()` is module-cached, so passing the same loader to both
 * `dynamic()` and this hook results in a single network request. The
 * second `.then` lands against the already-resolved promise.
 */

import { useEffect, useState } from "react";
import { useBootLoader } from "./useBootLoader";
import type { LoaderPhase } from "@/components/landing-hero/hooks";

export type EditorChunkState =
  | { status: "loading" | "ready"; phase: LoaderPhase; error: null }
  | { status: "error"; phase: LoaderPhase; error: Error };

/**
 * Watches a dynamic chunk's import and exposes a phase machine plus an
 * error slot. `loader` MUST be referentially stable across renders (i.e.
 * defined at module scope, not inside the component) — otherwise the
 * effect re-runs on every render and we trigger fresh network requests.
 */
export function useEditorChunk(
  loader: () => Promise<unknown>,
): EditorChunkState {
  const [chunkReady, setChunkReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    loader().then(
      () => {
        if (!cancelled) setChunkReady(true);
      },
      (err: unknown) => {
        if (cancelled) return;
        /* The boot-loader phase stays in `pulse` indefinitely on error.
           We expose the Error so the mount can render an error card
           with a retry / reload affordance instead of an infinite
           spinner — a silent stall is the worst UX failure mode. */
        const wrapped = err instanceof Error ? err : new Error(String(err));
        console.error("useEditorChunk: chunk import failed", wrapped);
        setError(wrapped);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [loader]);

  const phase = useBootLoader(chunkReady);

  if (error) {
    return { status: "error", phase, error };
  }
  return {
    status: chunkReady ? "ready" : "loading",
    phase,
    error: null,
  };
}
