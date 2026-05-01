"use client";

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
 * tightly coupled to the Solo plan definition in `lib/constants`.
 */

import Link from "next/link";

import styles from "./hero-solo-cta.module.css";

export function HeroSoloCta() {
    return (
        <div className={styles.wrapper}>
            <p className={styles.copy}>
                <span className={styles.planName}>Solo</span> — 100 free
                credits every month
            </p>

            <div className={styles.actions}>
                <Link href="/login?from=/studio" className={styles.primaryCta}>
                    Start creating — free
                    <span className={styles.arrow} aria-hidden="true">
                        →
                    </span>
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
