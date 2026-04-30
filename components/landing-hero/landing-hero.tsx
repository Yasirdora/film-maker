/**
 * LandingHero — server component that composes the entire landing tree.
 *
 * Only the small `<LandingHeroShell>` wrapper is a client component;
 * everything passed inside it as `children` is server-rendered (those
 * children may themselves be client components, but they only get
 * client-bundled if they declare `"use client"` themselves).
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
 * Static copy and data live in ./content.ts — edit there for messaging
 * changes without touching component logic. Props are reserved for
 * runtime-only config (e.g. environment keys).
 */

import Link from "next/link";

import StickyNav from "@/components/landing-blocks/sections/StickyNav";
import NextGenAISection from "@/components/landing-blocks/sections/NextGenAISection";
import GenerationSection from "@/components/landing-blocks/sections/GenerationSection";
import AutomationSection from "@/components/landing-blocks/sections/AutomationSection";
import BenefitsSection from "@/components/landing-blocks/sections/BenefitsSection";
import AppDownload from "@/components/landing-blocks/sections/AppDownload";
import Spacer from "@/components/landing-blocks/shared/Spacer";

import { AnnouncementBanner } from "./announcement-banner";
import { COPY, HERO_VIDEO_SOURCES, SHOWCASE_SLIDES } from "./content";
import { EditorToolbar } from "./editor-toolbar";
import { FeatureVideo } from "./feature-video";
import { HeroBackground } from "./hero-background";
import { HeroContent } from "./hero-content";
import { HeroPrompt } from "./hero-prompt";
import { LandingHeroShell } from "./landing-hero-shell";
import { ModelProviders } from "./model-providers";
import { PromptShowcase } from "./prompt-showcase";
import { ScrollIndicator } from "./scroll-indicator";
import { TaglineSection } from "./tagline-section";

import announcementStyles from "./announcement-banner.module.css";
import taglineStyles from "./tagline-section.module.css";
import styles from "./landing-hero.module.css";

// ─── JSX copy (depends on styles/components — kept in this file) ──────────

const ANNOUNCEMENT_BODY = (
    <>
        Film-maker is in limited testing —{" "}
        <Link href="/pricing" className={announcementStyles.announcementLink}>
            try Solo today
        </Link>
        . Our production tiers are still being fine-tuned, so drop your
        email and we&apos;ll reach out when your spot opens up.
    </>
);

const TAGLINE_LEAD = (
    <>
        Great stories <b>start with you.</b>
    </>
);

// ─── Component ─────────────────────────────────────────────────────────────

interface LandingHeroProps {
    turnstileSiteKey: string;
}

export function LandingHero({ turnstileSiteKey }: LandingHeroProps) {
    return (
        <LandingHeroShell>
            <section className={styles.hero}>
                <HeroBackground sources={HERO_VIDEO_SOURCES} />

                <AnnouncementBanner
                    headline={COPY.announcementHeadline}
                    body={ANNOUNCEMENT_BODY}
                    turnstileSiteKey={turnstileSiteKey}
                />

                <div className={styles.heroBottom}>
                    <HeroContent
                        headline={COPY.headline}
                        description={COPY.description}
                    />

                    <div className={styles.heroSearchSide}>
                        <HeroPrompt placeholder={COPY.promptPlaceholder} />
                    </div>
                </div>

                <EditorToolbar />
            </section>

            <ModelProviders />

            <ScrollIndicator targetId="tagline" />

            <TaglineSection
                id="tagline"
                lead={TAGLINE_LEAD}
                middleContent={
                    <div className={taglineStyles.showcaseIntro}>
                        <h2 className={taglineStyles.showcaseIntroHeadline}>
                            <span
                                className={
                                    taglineStyles.showcaseIntroHeadlineLead
                                }
                            >
                                {COPY.showcaseHeadlineLead}
                            </span>
                            <span
                                className={
                                    taglineStyles.showcaseIntroHeadlineEmphasis
                                }
                            >
                                {COPY.showcaseHeadlineEmphasis}
                            </span>
                        </h2>
                    </div>
                }
                cta={COPY.taglineCta}
            />

            <PromptShowcase slides={SHOWCASE_SLIDES} />

            <section
                id="sticky-nav-headline"
                className={styles.showcaseOutro}
            >
                <h2 className={styles.showcaseOutroHeadline}>
                    <span className={styles.showcaseOutroHeadlineLead}>
                        {COPY.showcaseOutroLead}
                    </span>
                    <span className={styles.showcaseOutroHeadlineEmphasis}>
                        {COPY.showcaseOutroEmphasis}
                    </span>
                </h2>
            </section>

            <StickyNav />

            <FeatureVideo
                src="/assets/Mercedes.mp4"
                label="Mercedes showcase film"
            />

            <NextGenAISection />
            <GenerationSection />
            <AutomationSection />
            <BenefitsSection />
            <Spacer size="R14" />
            <AppDownload />
            <Spacer size="R14" />
        </LandingHeroShell>
    );
}
