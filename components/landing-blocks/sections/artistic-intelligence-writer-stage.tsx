"use client";

/**
 * ArtisticIntelligenceWriterStage — the looping writer clip + floating overlays
 * inside the Artistic Intelligence tile.
 *
 * Extracted so the playback can be gated on viewport visibility
 * (parent is a server component). Without this, the video autoplays
 * and decodes on every page that includes the section, even when
 * scrolled offscreen — wasted bandwidth + battery.
 */

import { useEffect, useRef } from "react";

import { ArtisticIntelligenceIcon } from "../../icons/artistic-intelligence-icon";
import { HeroPrompt } from "@/components/landing-hero/hero-prompt";
import { useInView } from "../shared/use-in-view";

const ASSET_SRC = "/assets/Ysrdora.webm";
const PROMPT_PLACEHOLDER = "Draft a treatment with Artistic Intelligence";

export function ArtisticIntelligenceWriterStage() {
    const stageRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const inView = useInView(stageRef, { threshold: 0.25 });

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        if (inView) {
            video.play().catch(() => {});
        } else {
            video.pause();
        }
    }, [inView]);

    return (
        <div ref={stageRef} className="artistic-intelligence-float-stage">
            <video
                ref={videoRef}
                className="artistic-intelligence-float-video"
                src={ASSET_SRC}
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="Writer working on a couch with a tablet and notebook."
            />
            <div className="artistic-intelligence-float-icon" aria-hidden="true">
                <ArtisticIntelligenceIcon size={48} />
            </div>
            <div className="artistic-intelligence-float-prompt">
                <HeroPrompt
                    placeholder={PROMPT_PLACEHOLDER}
                    wrapperClassName="artistic-intelligence-float-prompt-bar"
                />
            </div>
        </div>
    );
}
