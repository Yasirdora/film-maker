"use client";

/**
 * Ambient video background for the hero. Three stacked layers:
 *
 *   1. <video>        — autoplaying, muted, looped MP4.
 *   2. .heroOverlay   — dark gradient so the video reads as a backdrop.
 *   3. .heroBlur      — local bottom-left blur that keeps the headline
 *                       legible over bright frames without dulling the
 *                       whole image.
 *
 * Reduced-motion users get a still poster instead of the autoplaying
 * video — both to honour the OS-level preference and to skip the
 * bandwidth cost of streaming a clip they don't want to see.
 */

import { useEffect, useRef } from "react";

import styles from "./hero-background.module.css";

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
    /** Optional still frame shown until the first video frame paints,
     *  and as the permanent visual for reduced-motion users. */
    poster?: string;
}

export function HeroBackground({ sources, poster }: HeroBackgroundProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const motionQuery = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        );

        const sync = () => {
            if (motionQuery.matches) {
                video.pause();
                video.removeAttribute("autoplay");
            } else {
                video.play().catch(() => {});
            }
        };

        sync();
        motionQuery.addEventListener("change", sync);
        return () => motionQuery.removeEventListener("change", sync);
    }, []);

    return (
        <>
            <video
                ref={videoRef}
                className={styles.heroVideo}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster={poster}
                aria-hidden="true"
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
