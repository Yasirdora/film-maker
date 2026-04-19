"use client";

/**
 * Left column of the hero: brand mark, headline, and description. All
 * three pieces reveal sequentially once the loader finishes; the
 * caller supplies the reveal controller so the staging stays in sync
 * with the rest of the hero.
 */

import { FilmmakerLogo } from "@/components/icons/filmmaker-logo";

import styles from "./landing-hero.module.css";

interface RevealController {
    has: (key: string) => boolean;
    register: (key: string) => (el: HTMLElement | null) => void;
}

interface HeroContentProps {
    headline: string;
    description: string;
    reveal: RevealController;
}

export function HeroContent({
    headline,
    description,
    reveal,
}: HeroContentProps) {
    const titleActive = reveal.has("title");
    const headlineActive = reveal.has("headline");
    const descriptionActive = reveal.has("description");

    return (
        <div className={styles.heroContent}>
            <h1
                data-reveal="title"
                ref={reveal.register("title")}
                className={[
                    styles.title,
                    styles.reveal,
                    styles.revealDelay100,
                    titleActive && styles.revealActive,
                    titleActive && styles.titleRevealActive,
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                <FilmmakerLogo className={styles.titleSvg} />
            </h1>

            <div
                data-reveal="headline"
                ref={reveal.register("headline")}
                className={[
                    styles.headline,
                    styles.reveal,
                    styles.revealDelay200,
                    headlineActive && styles.revealActive,
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                {headline}
            </div>

            <p
                data-reveal="description"
                ref={reveal.register("description")}
                className={[
                    styles.description,
                    styles.reveal,
                    styles.revealDelay300,
                    descriptionActive && styles.revealActive,
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                {description}
            </p>
        </div>
    );
}
