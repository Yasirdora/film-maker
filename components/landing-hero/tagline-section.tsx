"use client";

/**
 * Below-the-fold tagline. Two lines of copy that reveal once scrolled
 * into view. The second line uses the Newsreader italic / gradient
 * treatment defined in the CSS module.
 */

import styles from "./landing-hero.module.css";

interface RevealController {
    has: (key: string) => boolean;
    register: (key: string) => (el: HTMLElement | null) => void;
}

interface TaglineSectionProps {
    lead: string;
    /** Optional italic accent + trail copy rendered below the lead. */
    accent?: string;
    trail?: string;
    /** Small muted line rendered under the accent. */
    subtitle?: string;
    reveal: RevealController;
}

export function TaglineSection({
    lead,
    accent,
    trail,
    subtitle,
    reveal,
}: TaglineSectionProps) {
    const active = reveal.has("tagline");
    const hasSecondLine = Boolean(accent || trail);

    return (
        <section
            data-reveal="tagline"
            ref={reveal.register("tagline")}
            className={[
                styles.taglineSection,
                styles.reveal,
                active && styles.revealActive,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <span className={styles.taglineMain}>{lead}</span>
            {hasSecondLine && (
                <>
                    <br />
                    {accent && (
                        <span className={styles.taglineAccent}>{accent}</span>
                    )}
                    {accent && trail ? " " : null}
                    {trail}
                </>
            )}
            {subtitle && (
                <span className={styles.taglineSubtitle}>{subtitle}</span>
            )}
        </section>
    );
}
