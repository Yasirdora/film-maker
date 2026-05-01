"use client";

/**
 * useShowcaseCarousel — drives the prompt-showcase carousel.
 *
 * Owns every imperative concern: ordered slide list, active index,
 * on-screen visibility, per-card video element refs, track + container
 * DOM refs, and the Web-Animations-API choreography that moves the
 * track between slides. The component that consumes this hook is
 * purely presentational — it attaches the returned refs and renders
 * `rows` with the supplied `preloadFor` and nav handlers.
 *
 * Motion model
 *   The track holds N cards laid out in a flex row. `goNext` slides
 *   the track one card-width to the left while fading the leading
 *   card out, then imperatively moves that card to the tail and snaps
 *   the transform back to zero. `goPrev` does the inverse: pre-shifts
 *   the tail to the head, offsets the track invisibly, then animates
 *   back to zero while fading the new head in. The DOM order is
 *   always the current logical order — no visual clones — so SSR
 *   output stays clean and reconciliation never happens during the
 *   animation.
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
import { flushSync } from "react-dom";

import type { ShowcaseSlide } from "./content";

// ─── Animation constants ──────────────────────────────────────────────────

// Symmetric ease-in-out feels silkier than a pure ease-out here
// because the slide has to reverse direction against eye tracking.
// 1000ms gives the curve room to breathe without dragging.
const DURATION_MS = 1000;
const EASING = "cubic-bezier(0.65, 0, 0.35, 1)";

/** Slides this far from the active slot get `preload="auto"`. Slides
 *  beyond that get `preload="none"` so they don't pull megabytes of
 *  video data on initial page load. The active card's neighbors
 *  upgrade to "auto" the moment they slide into the radius. */
const PRELOAD_NEIGHBOR_RADIUS = 1;

// ─── Public shape ─────────────────────────────────────────────────────────

export interface ShowcaseCarousel {
    /** Ref placed on the outermost wrapper — observed for visibility. */
    containerRef: RefObject<HTMLDivElement | null>;
    /** Ref placed on the flex track — animated imperatively. */
    trackRef: RefObject<HTMLDivElement | null>;
    /** Ref-callback factory for the per-card <video> elements. */
    registerVideo: (id: string) => (node: HTMLVideoElement | null) => void;
    /** Slides in their current display order — the component maps over this. */
    rows: readonly ShowcaseSlide[];
    /** Resolves the appropriate `preload` attribute for a slot position. */
    preloadFor: (slotPosition: number) => "auto" | "none";
    /** Advance one slide forward. */
    goNext: () => void;
    /** Step one slide backward. */
    goPrev: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useShowcaseCarousel(
    slides: readonly ShowcaseSlide[],
): ShowcaseCarousel {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const trackRef = useRef<HTMLDivElement | null>(null);
    const stepWidthRef = useRef(0);
    const isAnimatingRef = useRef(false);
    const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
    const [isInView, setIsInView] = useState(false);

    const registerVideo = useCallback(
        (id: string) => (node: HTMLVideoElement | null) => {
            if (node) videoRefs.current.set(id, node);
            else videoRefs.current.delete(id);
        },
        [],
    );

    // Logical order of slides. Mutated when the user steps through the
    // carousel so React keeps rendering them in the correct row position
    // after each imperative DOM shuffle settles.
    const [order, setOrder] = useState(() => slides.map((_, i) => i));
    const [activeIndex, setActiveIndex] = useState(0);

    // Mirrors activeIndex for synchronous reads inside goNext/goPrev —
    // we need to know the next slide's id BEFORE React commits the
    // state update so we can rewind the incoming video before the
    // slide animation begins.
    const activeIndexRef = useRef(0);
    useEffect(() => {
        activeIndexRef.current = activeIndex;
    }, [activeIndex]);

    const advanceActive = useCallback(
        (delta: 1 | -1) => {
            setActiveIndex(
                (current) => (current + delta + slides.length) % slides.length,
            );
        },
        [slides.length],
    );

    // Called at the END of a slide transition, once the outgoing card
    // is fully off-screen. Rewinds every non-active video so the next
    // time any of them rotates back into view it starts at frame 0.
    // Safe here because only the active card is in the viewport — any
    // currentTime = 0 jump on other cards is invisible.
    const rewindInactiveVideos = useCallback((activeId: string | undefined) => {
        videoRefs.current.forEach((video, id) => {
            if (id === activeId) return;
            try {
                video.currentTime = 0;
            } catch {
                /* some browsers throw before metadata loads — ignore */
            }
        });
    }, []);

    const measureStep = useCallback(() => {
        const track = trackRef.current;
        const first = track?.firstElementChild as HTMLElement | null;
        if (!track || !first) return;
        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        stepWidthRef.current = first.getBoundingClientRect().width + gap;
    }, []);

    useLayoutEffect(() => {
        measureStep();
        const observer = new ResizeObserver(measureStep);
        if (trackRef.current) observer.observe(trackRef.current);
        return () => observer.disconnect();
    }, [measureStep]);

    /**
     * Animate the track with the Web Animations API alongside an
     * opacity fade on the card that's entering or leaving frame.
     *
     * `fadingCard` is the card we fade. `fadeDirection` is "out" when
     * it should start at 1 and end at 0 (next-slide: the card sliding
     * off the left edge) or "in" when it should start at 0 and end at
     * 1 (prev-slide: the card entering from the left after a pre-shift).
     *
     * Returns a promise that resolves when the track animation actually
     * finishes on the compositor — no setTimeout drift.
     */
    const runSlide = useCallback(
        (
            fromPx: number,
            toPx: number,
            fadingCard: HTMLElement | null,
            fadeDirection: "out" | "in",
        ): Promise<void> => {
            const track = trackRef.current;
            if (!track) return Promise.resolve();

            const trackAnim = track.animate(
                [
                    { transform: `translate3d(${fromPx}px, 0, 0)` },
                    { transform: `translate3d(${toPx}px, 0, 0)` },
                ],
                { duration: DURATION_MS, easing: EASING, fill: "forwards" },
            );

            let fadeAnim: Animation | null = null;
            if (fadingCard) {
                const [from, to] = fadeDirection === "out" ? [1, 0] : [0, 1];
                fadeAnim = fadingCard.animate(
                    [{ opacity: from }, { opacity: to }],
                    {
                        duration: DURATION_MS,
                        easing: EASING,
                        fill: "forwards",
                    },
                );
            }

            return trackAnim.finished.then(
                () => {
                    track.style.transform = `translate3d(${toPx}px, 0, 0)`;
                    trackAnim.cancel();
                    if (fadingCard && fadeAnim) {
                        // Bake the final opacity so it survives the
                        // animation cancel. For cards sliding out we
                        // leave them invisible until the DOM reorder
                        // puts them back at the tail — goNext then
                        // resets opacity to 1 post-reorder.
                        fadingCard.style.opacity =
                            fadeDirection === "out" ? "0" : "1";
                        fadeAnim.cancel();
                    }
                },
                () => {
                    /* cancelled (unmount) — swallow */
                },
            );
        },
        [],
    );

    const goNext = useCallback(async () => {
        const track = trackRef.current;
        if (!track || isAnimatingRef.current || slides.length < 2) return;
        isAnimatingRef.current = true;

        const nextIndex = (activeIndexRef.current + 1) % slides.length;
        advanceActive(1);

        // The first card is the one sliding off the left edge — fade it out.
        const outgoing = track.firstElementChild as HTMLElement | null;
        await runSlide(0, -stepWidthRef.current, outgoing, "out");

        // Commit the DOM reorder synchronously, snap transform back to
        // 0, then restore opacity on the card we faded (it's now at the
        // tail and must be visible for future rotations).
        flushSync(() => {
            setOrder((prev) => [...prev.slice(1), prev[0]]);
        });
        if (trackRef.current) {
            trackRef.current.style.transform = "translate3d(0, 0, 0)";
            void trackRef.current.offsetHeight;
        }
        if (outgoing) outgoing.style.opacity = "1";
        // Outgoing card is now at the tail, fully off-screen. Rewind
        // every inactive video so next rotations start at frame 0.
        rewindInactiveVideos(slides[nextIndex]?.id);
        isAnimatingRef.current = false;
    }, [advanceActive, rewindInactiveVideos, runSlide, slides]);

    const goPrev = useCallback(async () => {
        const track = trackRef.current;
        if (!track || isAnimatingRef.current || slides.length < 2) return;
        isAnimatingRef.current = true;

        const prevIndex =
            (activeIndexRef.current - 1 + slides.length) % slides.length;
        advanceActive(-1);

        // Pre-shift tail to head, offset track invisibly, then animate back.
        flushSync(() => {
            setOrder((prev) => [prev[prev.length - 1], ...prev.slice(0, -1)]);
        });
        track.style.transform = `translate3d(-${stepWidthRef.current}px, 0, 0)`;
        void track.offsetHeight;

        // The new head (previously the tail) needs to fade IN as the
        // track slides right — the user should see it materialize,
        // not pop at full opacity.
        const incoming = track.firstElementChild as HTMLElement | null;
        if (incoming) incoming.style.opacity = "0";
        await runSlide(-stepWidthRef.current, 0, incoming, "in");

        // Old active is now the second child, off-screen to the right.
        // Rewind every inactive video so they're ready for next rotations.
        rewindInactiveVideos(slides[prevIndex]?.id);
        isAnimatingRef.current = false;
    }, [advanceActive, rewindInactiveVideos, runSlide, slides]);

    // Pause playback + autoplay rotation while the showcase is offscreen.
    useEffect(() => {
        const node = containerRef.current;
        if (!node) return;
        const observer = new IntersectionObserver(
            ([entry]) => setIsInView(entry.isIntersecting),
            { threshold: 0.35 },
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    // Stable ref to goNext so the ended-event listener always invokes
    // the latest version without needing goNext in the effect's
    // dependency array. This eliminates the race where goNext's
    // identity changes mid-playback and the effect re-runs — tearing
    // down the old listener — while a video is about to end, causing
    // the ended event to fire into the void between cleanup and
    // re-attach.
    const goNextRef = useRef(goNext);
    useEffect(() => {
        goNextRef.current = goNext;
    });

    // Only the active slide's video plays. Non-active videos pause but
    // keep their playhead so the outgoing clip doesn't snap to frame 0
    // while it's still visible during the slide. The rewind happens
    // AFTER each transition completes (rewindInactiveVideos in
    // goNext/goPrev) so next time any card rotates back into view it's
    // at frame 0. When the active video finishes playing it advances.
    useEffect(() => {
        const activeId = slides[activeIndex]?.id;
        let activeVideo: HTMLVideoElement | undefined;

        videoRefs.current.forEach((video, id) => {
            if (id === activeId && isInView) {
                activeVideo = video;
                video.play().catch(() => {});
            } else {
                video.pause();
            }
        });

        const onEnded = () => goNextRef.current();

        if (activeVideo && slides.length > 1) {
            activeVideo.addEventListener("ended", onEnded, { once: true });
        }

        return () => {
            activeVideo?.removeEventListener("ended", onEnded);
        };
    }, [activeIndex, slides, isInView]);

    const rows = useMemo(
        () => order.map((slotIndex) => slides[slotIndex]),
        [order, slides],
    );

    // Slot-aware preload: the active slide is at slot 0 in the row, so
    // each card's distance from the head of the visible row is its
    // distance from the active slot. Slides beyond the radius defer
    // their network fetch.
    const preloadFor = useCallback(
        (slotPosition: number): "auto" | "none" =>
            slotPosition <= PRELOAD_NEIGHBOR_RADIUS ? "auto" : "none",
        [],
    );

    return {
        containerRef,
        trackRef,
        registerVideo,
        rows,
        preloadFor,
        goNext,
        goPrev,
    };
}
