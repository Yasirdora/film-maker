"use client";

/**
 * Hooks local to the landing hero. Grouped in one file because each is
 * tightly coupled to the hero's presentation and none are used outside
 * this feature. If any later proves useful elsewhere, promote it to
 * `/hooks/` at the project root at that point — not before.
 */

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type RefObject,
} from "react";

/**
 * `useLayoutEffect` warns when rendered on the server, but `"use client"`
 * components still SSR in App Router. Fall back to `useEffect` on the
 * server (where it's a no-op anyway) so the warning never fires.
 */
const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

// ─── use-loader-phase ──────────────────────────────────────────────────────

export type LoaderPhase =
    | "pulse"     // initial idle pulse while the page boots
    | "ready"     // fonts + page are loaded, lock the icon steady
    | "clapping"  // one-shot clap animation
    | "finished"  // faded out, pointer-events disabled
    | "skipped";  // repeat visitor — skip the animation entirely

export interface LoaderState {
    /** Pass to `<ClapperboardLoader>` — drives its CSS class set. */
    phase: LoaderPhase;
    /** True once the page below the overlay should be focusable + visible. */
    mainInteractive: boolean;
}

const LOADER_SESSION_KEY = "fm-landing-loader-seen";

/** Safety timeout: the loader never blocks the page longer than this. */
const LOADER_MAX_WAIT_MS = 3_000;
const LOADER_CLAP_DELAY_MS = 300;
const LOADER_FADE_DELAY_MS = 800;

/**
 * Orchestrates the clapperboard intro. On first visit it waits for the
 * page to settle, runs the clap, then fades out. Return visits in the
 * same session and reduced-motion users skip straight to "skipped" so
 * the page is immediately interactive.
 *
 * Why a layout-effect — not a `useState` initializer — for the skip
 * detection: SSR renders `phase = "pulse"` (no access to `window` /
 * `sessionStorage` on the server). If the client picked a different
 * value during the first render, hydration would diverge from the
 * server output and React would either warn loudly or, worse, leave
 * the server-rendered loader DOM orphaned. By keeping the *initial*
 * render identical on both sides and dispatching `setPhase("skipped")`
 * inside `useLayoutEffect`, the update commits synchronously between
 * hydration and first paint — so skipped users still never see the
 * loader, but the JSX trees agree at hydration time.
 *
 * The state machine is monotonic — once `finished` or `skipped`, it
 * cannot re-enter earlier phases — so consumers can use it as a gate.
 */
export function useLoaderPhase(): LoaderState {
    const [phase, setPhase] = useState<LoaderPhase>("pulse");

    useIsomorphicLayoutEffect(() => {
        // ── Skip detection (runs before first paint) ───────────────────
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            setPhase("skipped");
            return;
        }
        try {
            if (sessionStorage.getItem(LOADER_SESSION_KEY) === "1") {
                setPhase("skipped");
                return;
            }
        } catch {
            // sessionStorage can throw in privacy mode — fall through
            // and play the loader every time as graceful degradation.
        }

        // ── Animation sequence (first-time visitor) ────────────────────
        let started = false;
        const timers: ReturnType<typeof setTimeout>[] = [];

        const startSequence = () => {
            if (started) return;
            started = true;
            setPhase("ready");
            timers.push(
                setTimeout(() => setPhase("clapping"), LOADER_CLAP_DELAY_MS),
                setTimeout(() => {
                    setPhase("finished");
                    try {
                        sessionStorage.setItem(LOADER_SESSION_KEY, "1");
                    } catch {
                        /* ignore — same reason as the read above */
                    }
                }, LOADER_FADE_DELAY_MS),
            );
        };

        if (document.readyState === "complete") {
            startSequence();
        } else {
            window.addEventListener("load", startSequence, { once: true });
        }

        // Safety net: if `load` never fires (e.g. a hung image), run
        // after a hard ceiling so the page becomes interactive.
        timers.push(setTimeout(startSequence, LOADER_MAX_WAIT_MS));

        return () => {
            window.removeEventListener("load", startSequence);
            timers.forEach(clearTimeout);
        };
    }, []);

    return useMemo(
        () => ({
            phase,
            mainInteractive: phase === "finished" || phase === "skipped",
        }),
        [phase],
    );
}

// ─── use-reveal-on-scroll ──────────────────────────────────────────────────

export interface RevealController {
    /** Returns true once the named element has entered the viewport. */
    has: (key: string) => boolean;
    /** Ref callback to register an element under a given key. */
    register: (key: string) => (el: HTMLElement | null) => void;
}

/**
 * Sets up a single IntersectionObserver that flips keyed elements into
 * a "revealed" state the first time they intersect. `armed` controls
 * when to start observing — keep it false while a boot loader is
 * running so the reveals don't fire before the user can see them.
 *
 * Each element observed is automatically unobserved after its first
 * intersection, so the observer's workload stays bounded.
 *
 * Lifecycle contract:
 *   • Elements registered while unarmed are tracked and observed
 *     in bulk the moment `armed` becomes true.
 *   • Elements registered AFTER the observer is armed are observed
 *     immediately — late mounts (tabs, conditional sections, route
 *     transitions) are first-class.
 *   • Unmounting unobserves the element so the observer never holds
 *     references to detached DOM nodes.
 */
export function useRevealOnScroll(armed: boolean): RevealController {
    const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
    const elements = useRef<Map<string, HTMLElement>>(new Map());
    const observerRef = useRef<IntersectionObserver | null>(null);

    const register = useCallback(
        (key: string) => (el: HTMLElement | null) => {
            const previous = elements.current.get(key);
            if (previous && previous !== el) {
                observerRef.current?.unobserve(previous);
            }
            if (el) {
                elements.current.set(key, el);
                observerRef.current?.observe(el);
            } else {
                elements.current.delete(key);
            }
        },
        [],
    );

    useEffect(() => {
        if (!armed) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    const key = entry.target.getAttribute("data-reveal");
                    if (key) {
                        setRevealed((prev) => {
                            if (prev.has(key)) return prev;
                            const next = new Set(prev);
                            next.add(key);
                            return next;
                        });
                    }
                    observer.unobserve(entry.target);
                }
            },
            { threshold: 0.1 },
        );
        observerRef.current = observer;

        // Pick up everything that registered while we were unarmed.
        // Ref callbacks fire during commit, before useEffect, so the
        // map already holds every reveal target rendered so far.
        elements.current.forEach((el) => observer.observe(el));

        return () => {
            observer.disconnect();
            observerRef.current = null;
        };
    }, [armed]);

    return useMemo(
        () => ({
            has: (key) => revealed.has(key),
            register,
        }),
        [revealed, register],
    );
}

// ─── use-click-outside ─────────────────────────────────────────────────────

/**
 * Dismisses a popover/menu layer when:
 *   1. A click lands outside the referenced element.
 *   2. The Escape key is pressed.
 *   3. Focus moves outside the referenced element (via Tab or
 *      programmatic focus shift).
 *
 * All three vectors are expected in WCAG-compliant dismissible overlays.
 * The `enabled` gate lets callers cheaply disable the listeners when
 * the menu is closed.
 *
 * The callback is held in a ref so callers don't need to memoize it.
 * This keeps the effect stable — listeners are only attached/detached
 * when `enabled` or `ref` change, not on every render.
 */
export function useClickOutside<T extends HTMLElement>(
    ref: RefObject<T | null>,
    enabled: boolean,
    onOutside: () => void,
): void {
    const onOutsideRef = useRef(onOutside);
    useEffect(() => {
        onOutsideRef.current = onOutside;
    });

    useEffect(() => {
        if (!enabled) return;

        const handlePointer = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (ref.current && !ref.current.contains(target)) {
                onOutsideRef.current();
            }
        };

        const handleKeydown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onOutsideRef.current();
            }
        };

        const handleFocusOut = (event: FocusEvent) => {
            // relatedTarget is the element receiving focus. If it's
            // outside (or null — e.g. focus left the document), dismiss.
            const next = event.relatedTarget as Node | null;
            if (ref.current && !ref.current.contains(next)) {
                onOutsideRef.current();
            }
        };

        document.addEventListener("mousedown", handlePointer);
        document.addEventListener("keydown", handleKeydown);
        ref.current?.addEventListener("focusout", handleFocusOut);

        const el = ref.current;
        return () => {
            document.removeEventListener("mousedown", handlePointer);
            document.removeEventListener("keydown", handleKeydown);
            el?.removeEventListener("focusout", handleFocusOut);
        };
    }, [ref, enabled]);
}
