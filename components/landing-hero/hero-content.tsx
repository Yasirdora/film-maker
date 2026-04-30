"use client";

/**
 * Left column of the hero: brand mark, headline, and description. All
 * three pieces reveal sequentially once the loader finishes. The
 * reveal controller is read from <LandingHeroShell> via context, so
 * this component can be rendered from a server parent without having
 * to thread a function prop across the client boundary.
 */

import clsx from "clsx";

import { FilmmakerLogo } from "@/components/icons/filmmaker-logo";

import { useReveal } from "./reveal-context";
import styles from "./hero-content.module.css";
import revealStyles from "./reveal.module.css";

interface HeroContentProps {
    headline: string;
    description: string;
}

export function HeroContent({ headline, description }: HeroContentProps) {
    const reveal = useReveal();
    const titleActive = reveal.has("title");
    const headlineActive = reveal.has("headline");
    const descriptionActive = reveal.has("description");

    return (
        <div className={styles.heroContent}>
            <h1
                data-reveal="title"
                ref={reveal.register("title")}
                aria-label="Film-maker"
                className={clsx(
                    styles.title,
                    revealStyles.reveal,
                    revealStyles.revealDelay100,
                    titleActive && revealStyles.revealActive,
                    titleActive && styles.titleRevealActive,
                )}
            >
                <FilmmakerLogo aria-hidden="true" className={styles.titleSvg} />
            </h1>

            <div
                data-reveal="headline"
                ref={reveal.register("headline")}
                className={clsx(
                    styles.headline,
                    revealStyles.reveal,
                    revealStyles.revealDelay200,
                    headlineActive && revealStyles.revealActive,
                )}
            >
                {headline}
            </div>

            <p
                data-reveal="description"
                ref={reveal.register("description")}
                className={clsx(
                    styles.description,
                    revealStyles.reveal,
                    revealStyles.revealDelay300,
                    descriptionActive && revealStyles.revealActive,
                )}
            >
                {description}
            </p>
        </div>
    );
}
