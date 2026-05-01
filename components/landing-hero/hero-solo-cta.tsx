/**
 * HeroSoloCta — minimal Solo-plan call-to-action for the hero section.
 *
 * Replaces the prompt bar in the above-the-fold hero. Sits inside a
 * glass container (same `--lp-glass-*` treatment as the old prompt bar)
 * so it has visual presence without competing with the headline. Content
 * is intentionally lightweight: a single line of copy, a primary "Start
 * creating" button, and a secondary "Plans" link.
 *
 * All copy is kept inline rather than piped through props because this
 * component has exactly one call-site (HeroSection) and the strings are
 * tightly coupled to the Solo plan definition in `lib/constants`. Stays
 * a server component — no interactivity beyond plain navigation links.
 */

import Link from "next/link";

import styles from "./hero-solo-cta.module.css";

export function HeroSoloCta() {
    return (
        <div className={styles.wrapper}>
            <p className={styles.copy}>
                <span className={styles.planName}>Solo</span> — 100 free
                credits, every month
            </p>

            <div className={styles.actions}>
                <Link href="/login?from=/studio" className={styles.primaryCta}>
                    Start creating — free
                    <RightArrowIcon className={styles.primaryCtaArrow} />
                </Link>
                <Link href="/pricing" className={styles.secondaryCta}>
                    Plans
                </Link>
            </div>

            <p className={styles.footnote}>
                No credit card required · upgrade anytime
            </p>
        </div>
    );
}

function RightArrowIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
    );
}
