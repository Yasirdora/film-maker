"use client";

/**
 * Editor boot-loader phase machine. Drives the `<ClapperboardLoader>`
 * overlay shown while the editor's dynamic chunk downloads, so the same
 * clapperboard intro the landing page plays also greets the user the
 * first time they open the editor route.
 *
 * Phase sequence (mirrors `useLoaderPhase` on the landing page so the
 * two surfaces feel identical):
 *
 *   pulse   ─ chunk still loading; clapperboard pulses gently.
 *   ready   ─ chunk has resolved; icon snaps steady.
 *   clapping─ one-shot clap animation runs (≈ 0.4s in CSS).
 *   finished─ overlay fades out via the CSS opacity transition.
 *
 * Why not reuse `useLoaderPhase` from `components/landing-hero/hooks.ts`
 * directly: that hook orchestrates around `window.load` + a session-
 * storage skip flag, neither of which apply here — we want the phase
 * to be driven by *the editor chunk's import promise*, not by the
 * surrounding page lifecycle. Sharing the `LoaderPhase` type from the
 * same module keeps the contract aligned.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LoaderPhase } from "@/components/landing-hero/hooks";

/**
 * `useLayoutEffect` warns when rendered on the server, but components
 * marked `"use client"` still SSR in the App Router. Fall back to
 * `useEffect` on the server (where it's a no-op anyway) so the warning
 * never fires. Mirrors the same trick in the landing-hero hooks file.
 */
const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Session-scoped flag: once a tab session has seen the editor boot
 * loader play to completion, subsequent mounts (route changes, full
 * reloads in the same tab) snap straight to "skipped" — no animation,
 * no curtain. Cleared automatically when the tab closes. Separate from
 * the landing page's flag so seeing the home-page intro doesn't silence
 * the editor's intro and vice versa.
 */
const SESSION_KEY = "fm-editor-boot-loader-seen";

/**
 * Pause between the chunk arriving and the clap starting. Gives the
 * icon a beat to settle from `pulse` into `ready` before the snap, so
 * the transition reads as deliberate rather than abrupt.
 */
const READY_TO_CLAP_MS = 300;

/**
 * Time from `ready` to `finished`. Matches the landing-page's
 * `LOADER_FADE_DELAY_MS` (800 ms total) so the clap animation always
 * gets the same ~500 ms window to play before the overlay fades out.
 */
const READY_TO_FINISHED_MS = 800;

/**
 * `ready` is the external "chunk loaded" signal. While false the hook
 * stays in `pulse`. The first true edge starts the ready → clapping →
 * finished sequence; subsequent toggles do nothing (the machine is
 * monotonic — once advanced past `pulse` it can't be re-entered).
 *
 * Implementation note: the effect deliberately depends only on `ready`,
 * not on `phase`. If `phase` were in the dep array, the subsequent
 * `setPhase("ready")` would trigger a re-render → effect cleanup →
 * `clearTimeout` on the pending clap and finished timers — and the
 * loader would freeze on "ready" forever. A ref-guarded one-shot is the
 * safe pattern (the landing-page `useLoaderPhase` uses the same trick
 * with a local `started` variable).
 */
export function useBootLoader(ready: boolean): LoaderPhase {
    const [phase, setPhase] = useState<LoaderPhase>("pulse");
    const startedRef = useRef(false);

    /* Skip detection. Runs before first paint so a repeat visitor never
       sees the pulse flash before we snap to "skipped". `useState` can't
       run this synchronously because the initial value has to match the
       server's render — `sessionStorage` doesn't exist on the server,
       and a divergence would trip a hydration mismatch. */
    useIsomorphicLayoutEffect(() => {
        if (typeof window === "undefined") return;
        try {
            if (sessionStorage.getItem(SESSION_KEY) === "1") {
                startedRef.current = true;
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setPhase("skipped");
            }
        } catch {
            /* sessionStorage can throw in privacy mode — fall through
               and play the loader, which is the graceful degradation. */
        }
    }, []);

    useEffect(() => {
        if (!ready || startedRef.current) return;
        startedRef.current = true;
        setPhase("ready");
        const clap = setTimeout(() => setPhase("clapping"), READY_TO_CLAP_MS);
        const done = setTimeout(() => {
            setPhase("finished");
            /* Set the flag only once the sequence has fully played out
               — if the user reloads mid-clap we'd rather show the rest
               of the animation than have it half-skipped. */
            try {
                sessionStorage.setItem(SESSION_KEY, "1");
            } catch {
                /* ignore — same reason as the read above */
            }
        }, READY_TO_FINISHED_MS);
        return () => {
            clearTimeout(clap);
            clearTimeout(done);
        };
    }, [ready]);

    return phase;
}
