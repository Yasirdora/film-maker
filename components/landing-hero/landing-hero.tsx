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
import { FeatureVideo } from "./feature-video";
import { HeroBackground } from "./hero-background";
import { HeroContent } from "./hero-content";
import { HeroPrompt } from "./hero-prompt";
import { ModelProviders } from "./model-providers";
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
    taglineCta: { href: "/studio", label: "Launch the studio" },
    showcaseHeadlineLead: "Discover a ",
    showcaseHeadlineEmphasis: "universe of possibilities.",
    showcaseOutroLead: "Create with our ",
    showcaseOutroEmphasis: "Artistic Intelligence.",
    footerYear: new Date().getFullYear(),
} as const;

// WebM (VP9) is ~50% smaller than the H.264 MP4 — modern browsers fetch
// it; older Safari versions fall back to the MP4. Browsers fetch only
// the first source whose `type` they can decode.
const HERO_VIDEO_SOURCES = [
    { src: "/assets/bg.webm", type: "video/webm; codecs=vp9" },
    { src: "/assets/bg.mp4", type: "video/mp4" },
] as const;

// Showcase reel. Swap in production renders as they land — the
// carousel reads this list verbatim and adapts to any length ≥ 2.
const SHOWCASE_SLIDES: readonly ShowcaseSlide[] = [
    {
        id: "slide-01",
        videoSrc: "/assets/01.mp4",
        label: "Neon rainfall.",
        prompt: "Courier through rainy Shinjuku, 35 mm handheld.",
    },
    {
        id: "slide-02",
        videoSrc: "/assets/02.mp4",
        label: "Sunrise atelier.",
        prompt: "Tailor at a Parisian window, golden-hour dolly-in.",
    },
    {
        id: "slide-03",
        videoSrc: "/assets/03.mp4",
        label: "The archive room.",
        prompt: "Historian, dusty film canister, single shaft of light.",
    },
    {
        id: "slide-04",
        videoSrc: "/assets/04.mp4",
        label: "Last takeoff.",
        prompt: "Astronaut at ignition, anamorphic dawn tarmac.",
    },
    {
        id: "slide-05",
        videoSrc: "/assets/05.mp4",
        label: "Quiet coast.",
        prompt: "Lighthouse keeper at dawn, pastel sea, long lens.",
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
                    <HeroBackground sources={HERO_VIDEO_SOURCES} />

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

                <ModelProviders />

                <ScrollIndicator />

                <TaglineSection
                    lead={COPY.taglineLead}
                    middleContent={
                        <div className={styles.showcaseIntro}>
                            <h2 className={styles.showcaseIntroHeadline}>
                                <span
                                    className={
                                        styles.showcaseIntroHeadlineLead
                                    }
                                >
                                    {COPY.showcaseHeadlineLead}
                                </span>
                                <span
                                    className={
                                        styles.showcaseIntroHeadlineEmphasis
                                    }
                                >
                                    {COPY.showcaseHeadlineEmphasis}
                                </span>
                            </h2>
                        </div>
                    }
                    cta={COPY.taglineCta}
                    reveal={reveal}
                />

                <PromptShowcase slides={SHOWCASE_SLIDES} autoplayInterval={7500} />

                <section className={styles.showcaseOutro}>
                    <h2 className={styles.showcaseOutroHeadline}>
                        <span className={styles.showcaseOutroHeadlineLead}>
                            {COPY.showcaseOutroLead}
                        </span>
                        <span className={styles.showcaseOutroHeadlineEmphasis}>
                            {COPY.showcaseOutroEmphasis}
                        </span>
                    </h2>
                </section>

                <FeatureVideo
                    src="/assets/Mercedes.mp4"
                    label="Mercedes showcase film"
                />
            </main>
        </>
    );
}
