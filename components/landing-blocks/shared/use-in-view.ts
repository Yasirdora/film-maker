"use client";

/**
 * useInView — track whether an element is in the viewport.
 *
 * Wraps IntersectionObserver in a hook with sensible defaults and a
 * `once` flag for "ever been visible" semantics (used to gate one-time
 * mounts: don't re-mount when the user scrolls back). Options are
 * accepted as primitives so the effect's dependency array stays stable.
 */

import { useEffect, useState, type RefObject } from "react";

interface UseInViewOptions {
    /** IntersectionObserver `threshold` (single value to keep deps stable). */
    threshold?: number;
    /** IntersectionObserver `rootMargin`. */
    rootMargin?: string;
    /** Stick at `true` after first becoming visible — useful for
     *  lazy-mount: don't tear down the heavy DOM when the user scrolls
     *  back past the element. */
    once?: boolean;
}

export function useInView<T extends HTMLElement>(
    ref: RefObject<T | null>,
    { threshold = 0, rootMargin = "0px", once = false }: UseInViewOptions = {},
): boolean {
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                const visible = entry?.isIntersecting ?? false;
                setInView(visible);
                if (visible && once) observer.disconnect();
            },
            { threshold, rootMargin },
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [ref, threshold, rootMargin, once]);

    return inView;
}
