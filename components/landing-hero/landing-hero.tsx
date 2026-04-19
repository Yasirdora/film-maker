"use client";

/**
 * LandingHero — client root that composes every hero piece.
 *
 * Responsibility: own the two pieces of global hero state (loader
 * phase, reveal-on-scroll controller) and stitch the presentational
 * children together. Individual pieces stay dumb; they receive what
 * they need and nothing more.
 *
 * Layout
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  Announcement banner (absolute, top-center)                  │
 *   │ ┌──────────────────────────────────────────────────────────┐ │
 *   │ │ Video background + overlay + local blur                  │ │
 *   │ │                                            ┌─ Editor rail │ │
 *   │ │   ┌── Hero bottom row ───────────────────┐ │ (desktop)   │ │
 *   │ │   │ Title + headline + description │ Prompt │            │ │
 *   │ │   └───────────────────────────────────────┘              │ │
 *   │ └──────────────────────────────────────────────────────────┘ │
 *   │  Scroll indicator                                            │
 *   │  Tagline section                                             │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Copy lives at the top of the file in `COPY` so edits don't require
 * diving into the JSX tree. Props are reserved for runtime-only config
 * (e.g. environment keys).
 */

import Link from "next/link";
import { Newsreader } from "next/font/google";

import { AppBrandMark } from "@/components/app-brand-mark";

import { AnnouncementBanner } from "./announcement-banner";
import { ClapperboardLoader } from "./clapperboard-loader";
import { EditorToolbar } from "./editor-toolbar";
import { HeroBackground } from "./hero-background";
import { HeroContent } from "./hero-content";
import { HeroPrompt } from "./hero-prompt";
import { PromptShowcase, type ShowcaseSlide } from "./prompt-showcase";
import { ScrollIndicator } from "./scroll-indicator";
import { TaglineSection } from "./tagline-section";
import { useLoaderPhase, useRevealOnScroll } from "./hooks";

import styles from "./landing-hero.module.css";

// ─── Copy ──────────────────────────────────────────────────────────────────

const COPY = {
    announcementHeadline: "We're still building — join the private beta",
    announcementBody: (
        <>
            Film-maker is in limited testing —{" "}
            <Link href="/pricing" className={styles.announcementLink}>
                try Solo today
            </Link>
            . Our production tiers are still being fine-tuned, so drop your
            email and we&apos;ll reach out when your spot opens up.
        </>
    ),
    headline: "without limits.",
    description:
        "Artistic Intelligence designed by and for filmmakers.",
    promptPlaceholder: "Ask Auteur anything about your creative vision...",
    taglineLead: "Great stories start with you.",
    footerYear: new Date().getFullYear(),
} as const;

const HERO_VIDEO_SRC = "/assets/bg.mp4";

// Showcase reel. Swap in production renders as they land — the
// carousel reads this list verbatim and adapts to any length ≥ 2.
const SHOWCASE_SLIDES: readonly ShowcaseSlide[] = [
    {
        id: "neon-rainfall",
        videoSrc: "/assets/bg.mp4",
        label: "Neon rainfall.",
        prompt:
            "A lone courier sprints through flooded Shinjuku alleys at 3 a.m., reflected neon smearing across the wet asphalt — 35 mm, shallow depth of field, handheld.",
    },
    {
        id: "sunrise-atelier",
        videoSrc: "/assets/signin-hero.mp4",
        label: "Sunrise atelier.",
        prompt:
            "Soft morning light breaks through a Parisian studio window as a tailor pins fabric to a mannequin. Warm grain, golden-hour bloom, patient dolly-in.",
    },
    {
        id: "archive-room",
        videoSrc: "/assets/bg.mp4",
        label: "The archive room.",
        prompt:
            "A historian pulls a century-old film canister from a dusty shelf; motes drift through a single shaft of light. Muted teals and ochres, slow orbit.",
    },
    {
        id: "last-takeoff",
        videoSrc: "/assets/signin-hero.mp4",
        label: "Last takeoff.",
        prompt:
            "An astronaut straps in as the cabin trembles; the camera holds on their eyes, then cuts to engines igniting across a dawn tarmac. Anamorphic, cinematic contrast.",
    },
];

// ─── Fonts ─────────────────────────────────────────────────────────────────

const newsreader = Newsreader({
    subsets: ["latin"],
    style: ["italic"],
    variable: "--font-newsreader",
    display: "swap",
});

// ─── Component ─────────────────────────────────────────────────────────────

interface LandingHeroProps {
    turnstileSiteKey: string;
}

export function LandingHero({ turnstileSiteKey }: LandingHeroProps) {
    const loaderPhase = useLoaderPhase();
    const loaderDone =
        loaderPhase === "finished" || loaderPhase === "skipped";
    const reveal = useRevealOnScroll(loaderDone);

    return (
        <>
            <ClapperboardLoader phase={loaderPhase} />

            <div
                className={`${styles.brandMark} ${
                    loaderDone ? styles.brandMarkVisible : styles.brandMarkHidden
                }`}
            >
                <AppBrandMark href="/" size="sm" />
            </div>

            <main
                className={`${newsreader.variable} ${styles.page} ${
                    loaderDone ? styles.pageReady : styles.pageHidden
                }`}
                aria-hidden={!loaderDone}
            >

                <section className={styles.hero}>
                    <HeroBackground videoSrc={HERO_VIDEO_SRC} />

                    <AnnouncementBanner
                        headline={COPY.announcementHeadline}
                        body={COPY.announcementBody}
                        turnstileSiteKey={turnstileSiteKey}
                    />

                    <div className={styles.heroBottom}>
                        <HeroContent
                            headline={COPY.headline}
                            description={COPY.description}
                            reveal={reveal}
                        />

                        <div className={styles.heroSearchSide}>
                            <HeroPrompt placeholder={COPY.promptPlaceholder} />
                        </div>
                    </div>

                    <EditorToolbar />
                </section>

                <ScrollIndicator />

                <TaglineSection lead={COPY.taglineLead} reveal={reveal} />

                <PromptShowcase slides={SHOWCASE_SLIDES} />
            </main>
        </>
    );
}
