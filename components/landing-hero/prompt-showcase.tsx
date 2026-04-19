"use client";

/**
 * PromptShowcase — auto-advancing video carousel that pairs each clip
 * with the prompt that produced it. Renders below the tagline heading
 * to give the claim "great stories start with you" a concrete visual.
 *
 * Motion model
 *   The track holds N cards laid out in a flex row. Advancing slides
 *   the track one card-width to the left, then imperatively moves the
 *   leading card to the tail and snaps back to zero. Rewinding does
 *   the reverse: pre-shift the tail to the head, offset the track,
 *   then animate back to zero. The DOM order is always the current
 *   logical order — no visual clones — which keeps SSR output clean
 *   and lets us avoid React reconciliation during the animation.
 *
 * Decoupled text cross-fade
 *   Prompt strings are stacked absolutely so they cross-fade without
 *   the row shifting as line counts change.
 */

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { flushSync } from "react-dom";

import styles from "./landing-hero.module.css";

// ─── Types ────────────────────────────────────────────────────────────────

export interface ShowcaseSlide {
    id: string;
    videoSrc: string;
    poster?: string;
    label: string;
    prompt: string;
}

interface PromptShowcaseProps {
    slides: readonly ShowcaseSlide[];
    /** ms between auto-advances. Set 0 to disable auto-play. */
    autoplayInterval?: number;
}

// ─── Animation constants ──────────────────────────────────────────────────

// Symmetric ease-in-out feels silkier than a pure ease-out here
// because the slide has to reverse direction against eye tracking.
// 1000 ms gives the curve room to breathe without dragging.
const DURATION_MS = 1000;
const EASING = "cubic-bezier(0.65, 0, 0.35, 1)";

// ─── Component ────────────────────────────────────────────────────────────

export function PromptShowcase({
    slides,
    autoplayInterval = 6000,
}: PromptShowcaseProps) {
    const trackRef = useRef<HTMLDivElement | null>(null);
    const stepWidthRef = useRef(0);
    const isAnimatingRef = useRef(false);
    const pausedRef = useRef(false);
    const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

    const registerVideo = useCallback(
        (id: string) => (node: HTMLVideoElement | null) => {
            if (node) videoRefs.current.set(id, node);
            else videoRefs.current.delete(id);
        },
        [],
    );

    // Logical order of slides. We mutate it when the user steps through
    // the carousel so React keeps rendering them in the correct row
    // position after the imperative DOM shuffle settles.
    const [order, setOrder] = useState(() => slides.map((_, i) => i));
    const [activeIndex, setActiveIndex] = useState(0);

    const advanceActive = useCallback(
        (delta: 1 | -1) => {
            setActiveIndex(
                (current) => (current + delta + slides.length) % slides.length,
            );
        },
        [slides.length],
    );

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
     * Returns a promise that resolves when the track animation
     * *actually* finishes on the compositor — no setTimeout drift.
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
        isAnimatingRef.current = false;
    }, [advanceActive, runSlide, slides.length]);

    const goPrev = useCallback(async () => {
        const track = trackRef.current;
        if (!track || isAnimatingRef.current || slides.length < 2) return;
        isAnimatingRef.current = true;

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

        isAnimatingRef.current = false;
    }, [advanceActive, runSlide, slides.length]);

    // Auto-advance (pauses while the pointer is over the component or
    // the tab is hidden, so the motion never steals focus from copy
    // the reader is actually looking at).
    useEffect(() => {
        if (!autoplayInterval || slides.length < 2) return;
        let timer: number | undefined;

        const schedule = () => {
            timer = window.setTimeout(() => {
                if (!pausedRef.current && !document.hidden) goNext();
                schedule();
            }, autoplayInterval);
        };
        schedule();

        return () => {
            if (timer) window.clearTimeout(timer);
        };
    }, [autoplayInterval, goNext, slides.length]);

    // Only the active slide's video plays. Non-active videos pause
    // but keep their playhead so the outgoing clip doesn't snap to
    // frame 0 while it's still visible during the slide.
    useEffect(() => {
        const activeId = slides[activeIndex]?.id;
        videoRefs.current.forEach((video, id) => {
            if (id === activeId) {
                const playResult = video.play();
                if (playResult && typeof playResult.catch === "function") {
                    playResult.catch(() => {});
                }
            } else {
                video.pause();
            }
        });
    }, [activeIndex, slides]);

    const rows = useMemo(
        () => order.map((slotIndex) => slides[slotIndex]),
        [order, slides],
    );

    return (
        <div
            className={styles.showcase}
            onMouseEnter={() => {
                pausedRef.current = true;
            }}
            onMouseLeave={() => {
                pausedRef.current = false;
            }}
        >
            <div className={styles.showcaseViewport}>
                <div className={styles.showcaseTrackWrapper}>
                    <div ref={trackRef} className={styles.showcaseTrack}>
                        {rows.map((slide) => (
                            <figure
                                key={slide.id}
                                className={styles.showcaseCard}
                                data-slide-id={slide.id}
                            >
                                <video
                                    ref={registerVideo(slide.id)}
                                    className={styles.showcaseVideo}
                                    src={slide.videoSrc}
                                    poster={slide.poster}
                                    muted
                                    loop
                                    playsInline
                                    preload="auto"
                                    disablePictureInPicture
                                />
                            </figure>
                        ))}
                    </div>
                </div>
            </div>

            <div className={styles.showcaseUi}>
                <div
                    className={styles.showcaseTextStage}
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {slides.map((slide, i) => (
                        <p
                            key={slide.id}
                            className={[
                                styles.showcaseTextLayer,
                                i === activeIndex &&
                                    styles.showcaseTextLayerActive,
                            ]
                                .filter(Boolean)
                                .join(" ")}
                            aria-hidden={i !== activeIndex}
                        >
                            <span className={styles.showcaseLabel}>
                                {slide.label}
                            </span>{" "}
                            <span className={styles.showcasePrompt}>
                                {slide.prompt}
                            </span>
                        </p>
                    ))}
                </div>

                <div className={styles.showcaseNav}>
                    <button
                        type="button"
                        className={styles.showcaseNavButton}
                        onClick={goPrev}
                        aria-label="Previous prompt"
                    >
                        <ChevronIcon direction="left" />
                    </button>
                    <button
                        type="button"
                        className={styles.showcaseNavButton}
                        onClick={goNext}
                        aria-label="Next prompt"
                    >
                        <ChevronIcon direction="right" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Icon ─────────────────────────────────────────────────────────────────

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
    const d = direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6";
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d={d} />
        </svg>
    );
}
