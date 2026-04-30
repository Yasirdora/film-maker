"use client";

/**
 * Below-the-fold tagline. Two lines of copy that reveal once scrolled
 * into view. The second line uses the Newsreader italic / gradient
 * treatment defined in the CSS module.
 */

import { useRouter } from "next/navigation";

import styles from "./landing-hero.module.css";

interface RevealController {
    has: (key: string) => boolean;
    register: (key: string) => (el: HTMLElement | null) => void;
}

interface TaglineCta {
    href: string;
    label: string;
}

interface TaglineSectionProps {
    lead: React.ReactNode;
    /** Optional italic accent + trail copy rendered below the lead. */
    accent?: string;
    trail?: string;
    /** Small muted line rendered under the accent. */
    subtitle?: string;
    /** Optional slot rendered between the lead and the trail/CTA. */
    middleContent?: React.ReactNode;
    /** Optional call-to-action rendered beneath the copy block. */
    cta?: TaglineCta;
    reveal: RevealController;
}

export function TaglineSection({
    lead,
    accent,
    trail,
    subtitle,
    middleContent,
    cta,
    reveal,
}: TaglineSectionProps) {
    const router = useRouter();
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
            {subtitle && (
                <span className={styles.taglineSubtitle}>{subtitle}</span>
            )}
            {cta && (
                <button
                    type="button"
                    className={styles.taglineCta}
                    onClick={() => router.push(cta.href)}
                >
                    {cta.label}
                </button>
            )}
        </section>
    );
}
