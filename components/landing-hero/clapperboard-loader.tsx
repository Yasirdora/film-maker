"use client";

/**
 * Boot-time loader overlay. Shows a clapperboard that pulses while the
 * page settles, then snaps the top arm shut before fading away. Repeat
 * visits within the same session skip the animation entirely.
 *
 * The clapperboard geometry (path data, viewBox, hinge) is shared via
 * `<ClapperboardArt>` so it stays consistent with every other place
 * the mark appears in the app.
 */

import clsx from "clsx";

import {
    CLAPPERBOARD_HINGE,
    CLAPPERBOARD_VIEWBOX,
    ClapperboardArt,
} from "@/components/icons/clapperboard-art";

import type { LoaderPhase } from "./hooks";
import styles from "./clapperboard-loader.module.css";

interface ClapperboardLoaderProps {
    phase: LoaderPhase;
}

export function ClapperboardLoader({ phase }: ClapperboardLoaderProps) {
    const isReady = phase === "ready" || phase === "clapping" || phase === "finished";
    const isClapping = phase === "clapping" || phase === "finished";

    const className = clsx(
        styles.loaderOverlay,
        phase === "skipped" && styles.loaderOverlaySkipped,
        isReady && styles.loaderOverlayReady,
        isClapping && styles.loaderOverlayClapping,
        phase === "finished" && styles.loaderOverlayFinished,
    );

    // Loader is purely decorative. Focus management for the gated page
    // content is handled by `inert` on <main> in LandingPageShell, so
    // the overlay can stay aria-hidden across every phase.
    return (
        <div className={className} aria-hidden="true">
            <div className={styles.loaderWrapper}>
                <svg
                    className={styles.loaderSvg}
                    viewBox={CLAPPERBOARD_VIEWBOX}
                    xmlns="http://www.w3.org/2000/svg"
                    focusable="false"
                >
                    <ClapperboardArt
                        baseClassName={styles.loaderPart}
                        topClassName={`${styles.loaderPart} ${styles.loaderTop}`}
                        topStyle={{ transformOrigin: CLAPPERBOARD_HINGE }}
                    />
                </svg>
            </div>
        </div>
    );
}
