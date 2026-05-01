/**
 * Static content for the landing hero.
 *
 * This file is the single source of truth for copy strings, video
 * sources, and showcase slide data displayed on the home page. Edit
 * here when updating messaging — no need to touch component logic.
 *
 * NOTE: JSX-bearing content that depends on CSS modules or components
 * (e.g. the announcement body with its styled <Link>) lives in the
 * parent component file, not here — only serializable, dependency-free
 * data belongs in this module.
 */

import type { HeroVideoSource } from "./hero-background";

/**
 * Shape of a single showcase slide. Lives here alongside the canonical
 * `SHOWCASE_SLIDES` data so the type and its source-of-truth values
 * can't drift apart.
 */
export interface ShowcaseSlide {
    id: string;
    videoSrc: string;
    poster?: string;
}

// ─── Copy ──────────────────────────────────────────────────────────────────

export const COPY = {
    announcementHeadline: "We're still building — join the private beta",
    headline: "without limits.",
    description: "Artistic Intelligence designed by and for filmmakers.",
    taglineCta: { href: "/studio", label: "Launch the studio" },
    showcaseHeadlineLead: "Discover a ",
    showcaseHeadlineEmphasis: "universe of possibilities.",
    showcaseOutroLead: "Create with our ",
    showcaseOutroEmphasis: "Artistic Intelligence.",
} as const;

// ─── Video sources ─────────────────────────────────────────────────────────

/**
 * Hero background video sources, ordered by preference.
 * WebM (VP9) is ~50% smaller than H.264 MP4 — modern browsers fetch it;
 * older Safari versions fall back to the MP4. Browsers fetch only the
 * first source whose `type` they can decode.
 */
export const HERO_VIDEO_SOURCES: readonly HeroVideoSource[] = [
    { src: "/assets/bg.webm", type: "video/webm; codecs=vp9" },
    { src: "/assets/bg.mp4", type: "video/mp4" },
];

// ─── Feature video ─────────────────────────────────────────────────────────

/** Standalone showcase clip rendered between the StickyNav and the
 *  product sections. Asset + label co-located with the rest of the
 *  marketing data. */
export const FEATURE_VIDEO = {
    src: "/assets/Mercedes.mp4",
    label: "Mercedes showcase film",
} as const;

// ─── Showcase slides ───────────────────────────────────────────────────────

/**
 * Showcase reel. Swap in production renders as they land — the carousel
 * reads this list verbatim and adapts to any length ≥ 2.
 */
export const SHOWCASE_SLIDES: readonly ShowcaseSlide[] = [
    { id: "slide-01", videoSrc: "/assets/showcase/01.mp4" },
    { id: "slide-02", videoSrc: "/assets/showcase/02.mp4" },
    { id: "slide-03", videoSrc: "/assets/showcase/03.mp4" },
    { id: "slide-04", videoSrc: "/assets/showcase/04.mp4" },
    { id: "slide-05", videoSrc: "/assets/showcase/05.mp4" },
];
