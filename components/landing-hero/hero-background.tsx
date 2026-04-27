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

export interface HeroVideoSource {
    src: string;
    /** MIME type w/ codecs hint, e.g. `video/webm; codecs=vp9`. Browsers
     *  use this to pick a source they can decode without fetching it. */
    type: string;
}

interface HeroBackgroundProps {
    /** One or more `<source>` entries, ordered by preference (smallest /
     *  most modern first). The browser fetches only the first match. */
    sources: readonly HeroVideoSource[];
    /** Accessible label for the decorative background video. */
    label?: string;
}

export function HeroBackground({
    sources,
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
                aria-label={label}
            >
                {sources.map((source) => (
                    <source key={source.src} src={source.src} type={source.type} />
                ))}
            </video>
            <div className={styles.heroOverlay} aria-hidden="true" />
            <div className={styles.heroBlur} aria-hidden="true" />
        </>
    );
}
