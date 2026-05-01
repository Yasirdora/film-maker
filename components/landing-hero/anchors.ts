/**
 * Anchor IDs referenced across the landing page.
 *
 * Centralized here so the producers (sections that render `id={...}`)
 * and the consumers (scroll-indicator targets, StickyNav scroll
 * triggers) compile against the same constant. Adding a new anchor
 * means adding one line — no string literals scattered across files.
 */

export const ANCHORS = {
    /** Tagline section — also the scroll-indicator's click target. */
    tagline: "tagline",
    /** Outro headline above StickyNav — StickyNav uses this to detect
     *  when it should pin to the top of the viewport. */
    stickyNavHeadline: "sticky-nav-headline",
} as const;

export type AnchorId = (typeof ANCHORS)[keyof typeof ANCHORS];
