"use client";

/**
 * Subtle "scroll for more" cue that sits just below the hero. Fades
 * out after the user has scrolled past a threshold. Click/tap scrolls
 * the viewport down by one screen height.
 */

import { useEffect, useState } from "react";

import styles from "./landing-hero.module.css";

const SCROLL_HIDE_PX = 50;

export function ScrollIndicator() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > SCROLL_HIDE_PX);
        // Read once on mount in case the browser restored a scroll pos.
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const scrollDown = () => {
        window.scrollTo({
            top: window.innerHeight,
            behavior: "smooth",
        });
    };

    return (
        <button
            type="button"
            aria-label="Scroll down"
            onClick={scrollDown}
            className={[
                styles.scrollIndicator,
                scrolled && styles.scrollIndicatorHidden,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <span className={styles.scrollLine} aria-hidden="true" />
        </button>
    );
}
