/**
 * CSS class name map.
 *
 * Only entries actually consumed by components live here. Most JSX uses
 * raw class strings inline; this map exists for the sticky nav, where
 * classes are referenced from JS (classList.toggle, conditional classes).
 *
 * Usage:  import { cx } from "@/styles/classNames";
 *         <div className={cx.jumplinksDesktop} />
 */

// prettier-ignore
export const cx = {
  // --- Eyebrow tag (used by the sticky-nav badge) ---
  eyebrowTag:             "eyebrow-tag",
  eyebrowDark:            "eyebrow-dark",
  eyebrowFilled:          "eyebrow-filled",
  eyebrowOutline:         "eyebrow-outline",
  eyebrowCompact:         "eyebrow-compact",
  eyebrowSize:            "eyebrow-size",

  // --- Sticky nav (jumplinks) ---
  jumplinksDesktop:       "jumplinks-desktop jumplinks-desktop-jumplinksDesktop jumplinks",
  jumplinksMobile:        "jumplinks-mobile jumplinks-mobile",
  jumplinksLayout:        "jumplinks-layout",
  jumplinksLinksList:     "jumplinks-links-list unstyled",
  jumplinksLink:          "jumplinks-link",
  jumplinksLinkActive:    "link:active",
  jumplinksCtasWrap:      "jumplinks-ctas-wrap",
  jumplinksCtasList:      "jumplinks-ctas-list unstyled",
  jumplinksCta:           "jumplinks-cta",
  jumplinksBadge:         "jumplinks-badge",
  jumplinksMenuWrap:      "jumplinks-menu-wrap",
  jumplinksMenuTrigger:   "jumplinks-menu-trigger",
  jumplinksMenuTriggerLabels: "jumplinks-menu-trigger-labels",
  jumplinksMenuTriggerLabel: "jumplinks-menu-trigger-label",
  jumplinksMenuTriggerIcon: "jumplinks-menu-trigger-icon",
  jumplinksMenu:          "jumplinks-menu",
  jumplinksMenuList:      "jumplinks-menu-list unstyled",
  jumplinksMenuLink:      "jumplinks-menu-link",
  stickyAfter:            "sticky-after",
  // State classes toggled imperatively by useStickyBehavior.
  stickyActive:           "sticky:active",
  jumplinksAtBottom:      "jumplinks:at-bottom",
  ctaVisible:             "cta:visible",
} as const;
