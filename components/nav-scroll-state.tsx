"use client";

/**
 * NavScrollState — port of google-one-next's Header scroll behavior.
 *
 * Toggles `y:scrolled`, `dir:down`, `dir:up` on the AppNav's <nav>
 * element so CSS can hide it (`translateY(-100%)`) when the sticky
 * pill nav is pinned and the user is scrolling down. Mirrors the
 * source logic verbatim: 5px delta threshold, 10px scroll trigger.
 *
 * Renders no DOM — pure scroll-listener side-effect.
 */

import { useEffect } from "react";

const THRESHOLD = 5;

export function NavScrollState() {
    useEffect(() => {
        const nav = document.getElementById("app-nav-root");
        if (!nav) return;

        let lastY = 0;
        let direction: "up" | "down" = "up";

        const onScroll = () => {
            const y = window.scrollY;
            const delta = y - lastY;

            if (delta > THRESHOLD) {
                direction = "down";
            } else if (delta < -THRESHOLD) {
                direction = "up";
            }

            const isScrolled = y > 10;
            const isDown = direction === "down";

            nav.classList.toggle("y:scrolled", isScrolled);
            nav.classList.toggle("dir:down", isDown && isScrolled);
            nav.classList.toggle("dir:up", !isDown);

            lastY = y;
        };

        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return null;
}
