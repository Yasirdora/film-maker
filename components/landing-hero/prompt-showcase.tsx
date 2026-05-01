"use client";

/**
 * PromptShowcase — auto-advancing video carousel that pairs each clip
 * with the prompt that produced it.
 *
 * The component is purely presentational. All carousel mechanics
 * (track measurement, Web Animations API choreography, DOM reorder via
 * flushSync, video play/pause + rewind, IntersectionObserver
 * visibility) live in `useShowcaseCarousel` next door. The motion
 * model is documented in detail there.
 */

import type { ShowcaseSlide } from "./content";
import { useShowcaseCarousel } from "./use-showcase-carousel";
import styles from "./prompt-showcase.module.css";

interface PromptShowcaseProps {
    slides: readonly ShowcaseSlide[];
}

export function PromptShowcase({ slides }: PromptShowcaseProps) {
    const {
        containerRef,
        trackRef,
        registerVideo,
        rows,
        preloadFor,
        goNext,
        goPrev,
    } = useShowcaseCarousel(slides);

    return (
        <div ref={containerRef} className={styles.showcase}>
            <div className={styles.showcaseViewport}>
                <div className={styles.showcaseTrackWrapper}>
                    <div ref={trackRef} className={styles.showcaseTrack}>
                        {rows.map((slide, slotPosition) => (
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
                                    playsInline
                                    preload={preloadFor(slotPosition)}
                                    disablePictureInPicture
                                />
                            </figure>
                        ))}
                    </div>
                </div>
            </div>

            <div className={styles.showcaseUi}>
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
