/**
 * HeroSection — the above-the-fold hero block.
 *
 * Contains the background video, announcement banner, brand headline,
 * Solo-plan CTA, and decorative editor toolbar. This is the genuine
 * "hero" — the full-viewport, visually-dominant opening of the landing
 * page.
 *
 * The Solo CTA replaced the earlier prompt bar (HeroPrompt) because:
 *   1. An identical prompt bar already lives in the Auteur section
 *      further down the page — the duplication diluted both.
 *   2. The hero's job is to answer "what do I do next?" — a free-plan
 *      CTA does that with zero cognitive overhead, while a prompt bar
 *      assumed intent the visitor hadn't formed yet.
 *
 * Extracted from the page-level composition so the hero's boundaries
 * are clear and self-contained. The parent (`LandingPage`) wraps this
 * alongside the below-fold sections in the shared page shell.
 */

import { AnnouncementBanner } from "./announcement-banner";
import { COPY, HERO_VIDEO_SOURCES } from "./content";
import { EditorToolbar } from "./editor-toolbar";
import { HeroBackground } from "./hero-background";
import { HeroContent } from "./hero-content";
import { HeroSoloCta } from "./hero-solo-cta";

import styles from "./landing-hero.module.css";

interface HeroSectionProps {
    /** Announcement banner copy — kept outside this file so messaging
     *  changes never touch component logic. */
    announcementBody: React.ReactNode;
    turnstileSiteKey: string;
}

export function HeroSection({
    announcementBody,
    turnstileSiteKey,
}: HeroSectionProps) {
    return (
        <section className={styles.hero} aria-label="Film-maker — Artistic Intelligence for filmmakers">
            <HeroBackground sources={HERO_VIDEO_SOURCES} />

            <AnnouncementBanner
                headline={COPY.announcementHeadline}
                body={announcementBody}
                turnstileSiteKey={turnstileSiteKey}
            />

            <div className={styles.heroBottom}>
                <HeroContent
                    headline={COPY.headline}
                    description={COPY.description}
                />

                <div className={styles.heroSearchSide}>
                    <HeroSoloCta />
                </div>
            </div>

            <EditorToolbar />
        </section>
    );
}
