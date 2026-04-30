"use client";

/**
 * Subtle "scroll for more" cue that sits just below the hero. Fades
 * out after the user has scrolled past a threshold. Click/tap scrolls
 * a named target section into view.
 */

import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";

import styles from "./scroll-indicator.module.css";

const SCROLL_HIDE_PX = 50;

interface ScrollIndicatorProps {
    /**
     * `id` of the element to scroll into view on click. If omitted, or
     * if no element with that id exists at click time, the indicator
     * falls back to scrolling one viewport-height further down.
     */
    targetId?: string;
}

export function ScrollIndicator({ targetId }: ScrollIndicatorProps) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > SCROLL_HIDE_PX);
        // Read once on mount in case the browser restored a scroll pos.
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const scrollDown = useCallback(() => {
        const target = targetId ? document.getElementById(targetId) : null;
        if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
        }
        // Fallback: nudge one viewport down from wherever we are now.
        window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
    }, [targetId]);

    return (
        <button
            type="button"
            aria-label="Scroll down"
            onClick={scrollDown}
            className={clsx(
                styles.scrollIndicator,
                scrolled && styles.scrollIndicatorHidden,
            )}
        >
            <span className={styles.scrollLine} aria-hidden="true" />
        </button>
    );
}
