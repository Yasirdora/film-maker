"use client";

/**
 * Below-the-fold tagline. Two lines of copy that reveal once scrolled
 * into view. The second line uses the Newsreader italic / gradient
 * treatment defined in the CSS module.
 *
 * The reveal controller is read from <LandingPageShell> via context.
 * This makes the component renderable from a server parent without
 * threading a function prop across the client boundary.
 */

import type { ReactNode } from "react";
import clsx from "clsx";
import Link from "next/link";

import { useReveal } from "./reveal-context";
import styles from "./tagline-section.module.css";
import revealStyles from "./reveal.module.css";

interface TaglineCta {
    href: string;
    label: string;
}

interface TaglineSectionProps {
    lead: ReactNode;
    /** Optional italic accent + trail copy rendered below the lead. */
    accent?: string;
    trail?: string;
    /** Optional slot rendered between the lead and the trail/CTA. */
    middleContent?: ReactNode;
    /** Optional call-to-action rendered beneath the copy block. */
    cta?: TaglineCta;
    /** DOM id — exposed so callers can deep-link or scroll to this section. */
    id?: string;
}

export function TaglineSection({
    lead,
    accent,
    trail,
    middleContent,
    cta,
    id,
}: TaglineSectionProps) {
    const reveal = useReveal();
    const active = reveal.has("tagline");
    const hasSecondLine = Boolean(accent || trail);

    return (
        <section
            id={id}
            data-reveal="tagline"
            ref={reveal.register("tagline")}
            className={clsx(
                styles.taglineSection,
                revealStyles.reveal,
                active && revealStyles.revealActive,
            )}
        >
            <span className={styles.taglineMain}>{lead}</span>
            {middleContent}
            {hasSecondLine && (
                <span className={styles.taglineSecondary}>
                    {accent && (
                        <span className={styles.taglineAccent}>{accent}</span>
                    )}
                    {accent && trail ? " " : null}
                    {trail}
                </span>
            )}
            {cta && (
                <Link href={cta.href} className={styles.taglineCta}>
                    {cta.label}
                </Link>
            )}
        </section>
    );
}
