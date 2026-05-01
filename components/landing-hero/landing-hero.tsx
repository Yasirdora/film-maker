/**
 * LandingPage — server component that composes the entire landing tree.
 *
 * Only the small `<LandingPageShell>` wrapper is a client component;
 * everything passed inside it as `children` is server-rendered (those
 * children may themselves be client components, but they only get
 * client-bundled if they declare `"use client"` themselves).
 *
 * Layout
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  <LandingPageShell>  (client — loader + reveal context)      │
 *   │ ┌────────────────────────────────────────────────────────────┐│
 *   ││ <HeroSection>  (above-fold hero block)                     ││
 *   │└────────────────────────────────────────────────────────────┘│
 *   │  <ModelProviders />  marquee                                 │
 *   │  <ScrollIndicator />                                         │
 *   │  <TaglineSection> + <ShowcaseIntroHeadline>                  │
 *   │  <PromptShowcase />  carousel                                │
 *   │  <ShowcaseOutroHeadline />                                   │
 *   │  ────────────────────────────────────────────────────────── │
 *   │  StickyNav │ FeatureVideo │ NextGenAI │ Generation │        │
 *   │  Automation │ Benefits │ AppDownload                        │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Static copy and data live in ./content.ts; cross-component anchor
 * IDs live in ./anchors.ts. Edit those files for messaging or
 * navigation changes without touching component logic. Props are
 * reserved for runtime-only config (e.g. environment keys).
 */

import Link from "next/link";

import StickyNav from "@/components/landing-blocks/sections/StickyNav";
import NextGenAISection from "@/components/landing-blocks/sections/NextGenAISection";
import GenerationSection from "@/components/landing-blocks/sections/GenerationSection";
import AutomationSection from "@/components/landing-blocks/sections/AutomationSection";
import BenefitsSection from "@/components/landing-blocks/sections/BenefitsSection";
import AppDownload from "@/components/landing-blocks/sections/AppDownload";
import Spacer from "@/components/landing-blocks/shared/Spacer";

import { ANCHORS } from "./anchors";
import { COPY, FEATURE_VIDEO, SHOWCASE_SLIDES } from "./content";
import { FeatureVideo } from "./feature-video";
import { HeroSection } from "./hero-section";
import { LandingPageShell } from "./landing-hero-shell";
import { ModelProviders } from "./model-providers";
import { PromptShowcase } from "./prompt-showcase";
import { ScrollIndicator } from "./scroll-indicator";
import {
    ShowcaseIntroHeadline,
    ShowcaseOutroHeadline,
} from "./showcase-headlines";
import { TaglineSection } from "./tagline-section";

import announcementStyles from "./announcement-banner.module.css";

// ─── JSX-bearing copy ──────────────────────────────────────────────────────
//
// Lives here rather than in content.ts because both fragments depend
// on JSX (a styled <Link>, a <b>) — content.ts is reserved for plain
// serializable data. The announcement body's style import is the only
// cross-module reference left in this file.

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

interface LandingPageProps {
    turnstileSiteKey: string;
}

/** Full landing-page composition. */
export function LandingPage({ turnstileSiteKey }: LandingPageProps) {
    return (
        <LandingPageShell>
            <HeroSection
                announcementBody={ANNOUNCEMENT_BODY}
                turnstileSiteKey={turnstileSiteKey}
            />

            <ModelProviders />

            <ScrollIndicator targetId={ANCHORS.tagline} />

            <TaglineSection
                id={ANCHORS.tagline}
                lead={TAGLINE_LEAD}
                middleContent={<ShowcaseIntroHeadline />}
                cta={COPY.taglineCta}
            />

            <PromptShowcase slides={SHOWCASE_SLIDES} />

            <ShowcaseOutroHeadline id={ANCHORS.stickyNavHeadline} />

            <StickyNav />

            <FeatureVideo src={FEATURE_VIDEO.src} label={FEATURE_VIDEO.label} />

            <NextGenAISection />
            <GenerationSection />
            <AutomationSection />
            <BenefitsSection />
            <Spacer size="R14" />
            <AppDownload />
            <Spacer size="R14" />
        </LandingPageShell>
    );
}
