/**
 * Showcase intro / outro headlines.
 *
 * The intro renders between the tagline lines (slotted via
 * `<TaglineSection middleContent>`); the outro is a standalone
 * section between the showcase carousel and the StickyNav.
 *
 * Co-located so both halves of the "discover possibilities → create
 * with our AI" framing live in one file — they were previously inline
 * JSX in the page composition root, which forced that file to import
 * CSS modules belonging to two other components.
 */

import { COPY } from "./content";

import introStyles from "./showcase-headlines.module.css";

export function ShowcaseIntroHeadline() {
    return (
        <div className={introStyles.intro}>
            <h2 className={introStyles.introHeadline}>
                <span className={introStyles.introHeadlineLead}>
                    {COPY.showcaseHeadlineLead}
                </span>
                <span className={introStyles.introHeadlineEmphasis}>
                    {COPY.showcaseHeadlineEmphasis}
                </span>
            </h2>
        </div>
    );
}

interface ShowcaseOutroHeadlineProps {
    /** DOM id — used by the StickyNav scroll-trigger anchor. */
    id?: string;
}

export function ShowcaseOutroHeadline({ id }: ShowcaseOutroHeadlineProps) {
    return (
        <section id={id} className={introStyles.outro}>
            <h2 className={introStyles.outroHeadline}>
                <span className={introStyles.outroHeadlineLead}>
                    {COPY.showcaseOutroLead}
                </span>
                <span className={introStyles.outroHeadlineEmphasis}>
                    {COPY.showcaseOutroEmphasis}
                </span>
            </h2>
        </section>
    );
}
