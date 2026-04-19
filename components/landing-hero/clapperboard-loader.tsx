"use client";

/**
 * Boot-time loader overlay. Shows a clapperboard that pulses while the
 * page settles, then snaps the top arm shut before fading away. Repeat
 * visits within the same session skip the animation entirely.
 *
 * The SVG viewBox matches ConveX's original clapperboard so the motion
 * (transform-origin, clap angle, etc.) reads identically.
 */

import type { LoaderPhase } from "./hooks";
import styles from "./landing-hero.module.css";

interface ClapperboardLoaderProps {
    phase: LoaderPhase;
}

export function ClapperboardLoader({ phase }: ClapperboardLoaderProps) {
    const className = [
        styles.loaderOverlay,
        phase === "skipped" && styles.loaderOverlaySkipped,
        (phase === "ready" || phase === "clapping" || phase === "finished") &&
            styles.loaderOverlayReady,
        (phase === "clapping" || phase === "finished") &&
            styles.loaderOverlayClapping,
        phase === "finished" && styles.loaderOverlayFinished,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={className} aria-hidden={phase !== "pulse"}>
            <div className={styles.loaderWrapper}>
                <svg
                    className={styles.loaderSvg}
                    viewBox="870 420 75 60"
                    xmlns="http://www.w3.org/2000/svg"
                    role="img"
                    aria-label="Film-maker logo loading"
                >
                    <rect
                        className={styles.loaderPart}
                        x="880.73"
                        y="448.09"
                        width="51.24"
                        height="26.61"
                        rx="1.02"
                        ry="1.02"
                    />
                    <path
                        className={`${styles.loaderPart} ${styles.loaderTop}`}
                        d="M882.45,448.09h47.91c.89,0,1.6-.72,1.6-1.6v-10.15c0-.89-.72-1.6-1.6-1.6h-47.17c-.84,0-1.54.65-1.6,1.49l-.74,10.15c-.07.93.67,1.72,1.6,1.72Z"
                    />
                </svg>
            </div>
        </div>
    );
}
