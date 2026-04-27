"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./landing-hero.module.css";

interface FeatureVideoProps {
    src: string;
    label: string;
}

// Start playing slightly before fully visible so the first frame
// isn't a freeze; pause once it's clearly off-screen so we don't
// burn cycles decoding frames the user can't see.
const VISIBILITY_THRESHOLD = 0.35;

export function FeatureVideo({ src, label }: FeatureVideoProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [muted, setMuted] = useState(true);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    const playResult = video.play();
                    if (playResult && typeof playResult.catch === "function") {
                        playResult.catch(() => {});
                    }
                } else {
                    video.pause();
                }
            },
            { threshold: VISIBILITY_THRESHOLD },
        );

        observer.observe(video);
        return () => observer.disconnect();
    }, []);

    const toggleMuted = () => {
        const video = videoRef.current;
        if (!video) return;
        const next = !muted;
        video.muted = next;
        if (!next) {
            const playResult = video.play();
            if (playResult && typeof playResult.catch === "function") {
                playResult.catch(() => {});
            }
        }
        setMuted(next);
    };

    return (
        <section className={styles.featureVideo}>
            <div className={styles.featureVideoFrame}>
                <video
                    ref={videoRef}
                    className={styles.featureVideoMedia}
                    src={src}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-label={label}
                />
                <button
                    type="button"
                    className={styles.featureVideoSoundToggle}
                    onClick={toggleMuted}
                    aria-pressed={!muted}
                    aria-label={muted ? "Unmute video" : "Mute video"}
                >
                    {muted ? <SoundOffIcon /> : <SoundOnIcon />}
                </button>
            </div>
        </section>
    );
}

function SoundOffIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
    );
}

function SoundOnIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
    );
}
