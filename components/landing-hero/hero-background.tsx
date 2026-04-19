/**
 * Ambient video background for the hero. Three stacked layers:
 *
 *   1. <video>        — autoplaying, muted, looped MP4.
 *   2. .heroOverlay   — dark gradient so the video reads as a backdrop.
 *   3. .heroBlur      — local bottom-left blur that keeps the headline
 *                       legible over bright frames without dulling the
 *                       whole image.
 *
 * Renders server-side — no client JS required for playback since the
 * browser's built-in autoplay handles it.
 */

import styles from "./landing-hero.module.css";

interface HeroBackgroundProps {
    videoSrc: string;
    /** Accessible label for the decorative background video. */
    label?: string;
}

export function HeroBackground({
    videoSrc,
    label = "Cinematic background loop",
}: HeroBackgroundProps) {
    return (
        <>
            <video
                className={styles.heroVideo}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                src={videoSrc}
                aria-label={label}
            />
            <div className={styles.heroOverlay} aria-hidden="true" />
            <div className={styles.heroBlur} aria-hidden="true" />
        </>
    );
}
