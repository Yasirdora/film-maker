"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@/styles/landing-blocks/classNames";
import Button from "../shared/Button";
import { FilmmakerIcon } from "../shared/FilmmakerIcon";

/* -------------------------------------------------------------------------- */
/*  Configuration                                                             */
/* -------------------------------------------------------------------------- */

interface NavLink {
  href: string;
  label: string;
  ariaLabel: string;
  badge?: boolean;
  isBrand?: boolean;
}

const NAV_LINKS: NavLink[] = [
  {
    // Brand link targets page root rather than colliding with Studio's #nextgen-ai.
    href: "#root",
    label: "Filmmaker Network",
    ariaLabel: "Back to top of Filmmaker Network",
    isBrand: true,
  },
  { href: "#nextgen-ai", label: "Studio", ariaLabel: "Go to section: Studio" },
  { href: "#productivity", label: "Generation", ariaLabel: "Go to section: Generation" },
  {
    href: "#auteur",
    label: "Auteur",
    ariaLabel: "Go to section: Auteur, the AI agent for filmmakers",
    badge: true,
  },
];

const SECTION_LINKS = NAV_LINKS.filter((l) => !l.isBrand);
const SECTION_IDS = SECTION_LINKS.map((l) => l.href.slice(1));

// Layout-anchor ids referenced by the scroll observer. These must exist
// somewhere on the page for the corresponding nav state to ever flip.
const ANCHORS = {
  /** When this element's top crosses the viewport top, the nav becomes "sticky". */
  stickyTrigger: "sticky-nav-headline",
  /** When this section is mostly in view, the nav slides off-screen. */
  pastContent: "benefits",
  /** When this section reaches the activation line, the nav reveals its CTA. */
  ctaTrigger: "script-to-screen",
} as const;

// A section becomes "active" once its top crosses this fraction of the viewport height.
const SECTION_ACTIVE_RATIO = 0.5;
// The past-content anchor must reach this fraction of the viewport for the nav to retract.
const PAST_CONTENT_RATIO = 0.6;

const BADGE_CLASS = [
  cx.jumplinksBadge,
  cx.eyebrowTag,
  cx.eyebrowDark,
  cx.eyebrowFilled,
  cx.eyebrowCompact,
  cx.eyebrowSize,
].join(" ");

const MOBILE_MENU_OPEN_CLASS = "menu:open";
const MOBILE_TRIGGER_LABEL_ACTIVE_CLASS = "active";

/* -------------------------------------------------------------------------- */
/*  Scroll-driven state                                                       */
/* -------------------------------------------------------------------------- */

interface NavState {
  /** href of the section currently in view, or null before any section is reached. */
  activeHref: string | null;
  /** Nav has been pinned to the top of the viewport. */
  isSticky: boolean;
  /** User has scrolled past all nav-tracked content. */
  isPastContent: boolean;
  /** A section that requests the CTA is in view. */
  ctaVisible: boolean;
}

const INITIAL_STATE: NavState = {
  activeHref: null,
  isSticky: false,
  isPastContent: false,
  ctaVisible: false,
};

function readNavState(): NavState {
  const activationY = window.innerHeight * SECTION_ACTIVE_RATIO;
  const pastContentY = window.innerHeight * PAST_CONTENT_RATIO;

  // Active section = the LAST section whose top has crossed the activation
  // line. This keeps the highlight on the most recently entered section even
  // after its bottom has scrolled past — until the next section takes over.
  let activeHref: string | null = null;
  for (const id of SECTION_IDS) {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top <= activationY) {
      activeHref = `#${id}`;
    }
  }

  const stickyTrigger = document.getElementById(ANCHORS.stickyTrigger);
  const pastContentEl = document.getElementById(ANCHORS.pastContent);
  const ctaTrigger = document.getElementById(ANCHORS.ctaTrigger);

  return {
    activeHref,
    isSticky: stickyTrigger
      ? stickyTrigger.getBoundingClientRect().top <= 0
      : false,
    isPastContent: pastContentEl
      ? pastContentEl.getBoundingClientRect().top < pastContentY
      : false,
    ctaVisible: ctaTrigger
      ? ctaTrigger.getBoundingClientRect().top <= activationY
      : false,
  };
}

function navStatesEqual(a: NavState, b: NavState): boolean {
  return (
    a.activeHref === b.activeHref &&
    a.isSticky === b.isSticky &&
    a.isPastContent === b.isPastContent &&
    a.ctaVisible === b.ctaVisible
  );
}

/**
 * Tracks scroll-driven nav state. Reads layout once per animation frame
 * (rAF-throttled) so a fast scroll produces at most ~60 reads/second.
 */
function useNavState(): NavState {
  const [state, setState] = useState<NavState>(INITIAL_STATE);

  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      const next = readNavState();
      setState((prev) => (navStatesEqual(prev, next) ? prev : next));
    };
    const schedule = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    };

    tick();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return state;
}

/**
 * Publishes the rendered CTA button width to a CSS custom property so the
 * stylesheet can animate the wrap from 0 → exact-content-width.
 */
function useCtaWidth(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const wrap = ref.current;
    const btn = wrap?.querySelector("a");
    if (!wrap || !btn) return;
    const width = Math.ceil(btn.getBoundingClientRect().width + 12);
    wrap.style.setProperty("--ctas-width", `${width}px`);
  }, [ref]);
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function classes(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function wrapperClass(base: string, state: NavState): string {
  return classes(
    base,
    state.isSticky && cx.stickyActive,
    state.isPastContent && cx.stickyAfter,
    state.isPastContent && cx.jumplinksAtBottom,
    state.ctaVisible && cx.ctaVisible,
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="10"
      viewBox="0 0 15 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M13 1.5L7.5 7.5L2 1.5"
        stroke="currentColor"
        strokeWidth="2.63636"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Subcomponents                                                             */
/* -------------------------------------------------------------------------- */

function DesktopNav({ state }: { state: NavState }) {
  const ctaWrapRef = useRef<HTMLDivElement>(null);
  useCtaWidth(ctaWrapRef);

  return (
    <div
      id="sticky-nav"
      className={wrapperClass(cx.jumplinksDesktop, state)}
      role="navigation"
    >
      <div className={cx.jumplinksLayout} data-slot="scroller">
        <ul className={cx.jumplinksLinksList}>
          {NAV_LINKS.map((link) => {
            const isActive = !link.isBrand && state.activeHref === link.href;
            return (
              <li key={link.label}>
                <a
                  className={classes(
                    cx.jumplinksLink,
                    isActive && cx.jumplinksLinkActive,
                  )}
                  href={link.href}
                  aria-label={link.ariaLabel}
                  data-slot="link"
                >
                  {link.badge && <div className={BADGE_CLASS}>New</div>}
                  {link.isBrand ? (
                    <FilmmakerIcon width={24} height={20} />
                  ) : (
                    <div>{link.label}</div>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
        <div className={cx.jumplinksCtasWrap} ref={ctaWrapRef}>
          <ul className={cx.jumplinksCtasList} data-slot="ctas">
            <li>
              <Button
                href="/pricing"
                ariaLabel="Go to Filmmaker Network plans page."
                className={cx.jumplinksCta}
              >
                Get started
              </Button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function MobileTriggerLabel({
  label,
  dataLink,
  isActive,
}: {
  label: string;
  dataLink: string;
  isActive: boolean;
}) {
  return (
    <div
      className={classes(
        cx.jumplinksMenuTriggerLabel,
        isActive && MOBILE_TRIGGER_LABEL_ACTIVE_CLASS,
      )}
      data-slot="mobile-menu-trigger-label"
      data-link={dataLink}
      {...(!isActive ? { inert: true } : {})}
    >
      {label}
    </div>
  );
}

function MobileNav({ state }: { state: NavState }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = useCallback(() => setMenuOpen((prev) => !prev), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <div className={wrapperClass(cx.jumplinksMobile, state)} role="navigation">
      <div className={cx.jumplinksMenuWrap}>
        <button
          className={cx.jumplinksMenuTrigger}
          data-slot="mobile-menu-trigger"
          aria-controls="sticky-nav-mobile-menu"
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          onClick={toggleMenu}
        >
          <div className={cx.jumplinksMenuTriggerLabels}>
            <MobileTriggerLabel
              label="Explore"
              dataLink="default"
              isActive={!state.activeHref}
            />
            {SECTION_LINKS.map((link) => (
              <MobileTriggerLabel
                key={link.label}
                label={link.label}
                dataLink={link.href}
                isActive={state.activeHref === link.href}
              />
            ))}
          </div>
          <ChevronDownIcon className={cx.jumplinksMenuTriggerIcon} />
        </button>
        <div
          id="sticky-nav-mobile-menu"
          className={classes(
            cx.jumplinksMenu,
            menuOpen && MOBILE_MENU_OPEN_CLASS,
          )}
          role="listbox"
          data-slot="mobile-menu"
          {...(!menuOpen ? { inert: true } : {})}
        >
          <ul className={cx.jumplinksMenuList}>
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <a
                  className={cx.jumplinksMenuLink}
                  href={link.href}
                  aria-selected={
                    !link.isBrand && state.activeHref === link.href
                  }
                  data-slot="link"
                  onClick={closeMenu}
                >
                  {link.badge && <div className={BADGE_CLASS}>New</div>}
                  {link.isBrand ? (
                    <FilmmakerIcon width={20} height={16} />
                  ) : (
                    link.label
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <ul className="unstyled jumplinks-mobile-ctas">
        <li>
          <Button href="/pricing">Get started</Button>
        </li>
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function StickyNav() {
  const state = useNavState();
  return (
    <>
      <DesktopNav state={state} />
      <MobileNav state={state} />
    </>
  );
}
