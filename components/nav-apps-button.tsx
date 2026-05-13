"use client";

/**
 * NavAppsButton — Launchpad trigger for the nav.
 *
 * Renders mobile-tab and desktop-pill variants of the trigger. Clicking
 * either calls into `useLaunchpad()` to open the shared Launchpad modal
 * (mounted once by `LaunchpadHost` near the app root). The component
 * itself is stateless — that's how multiple triggers can coexist on the
 * same page (e.g. mobile bottom tab + desktop header pill) without each
 * mounting its own modal and ⌘K listener.
 *
 * The mobile tab is shaped for a bottom tab bar (`w-[25%] h-full`).
 * Headers that aren't tab bars (e.g. the editor header) should pass
 * `showMobileTab={false}` so the trigger appears only at `sm+`.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { useLaunchpad } from "./launchpad-host";

interface NavAppsButtonProps {
    showMobileTab?: boolean;
}

export function NavAppsButton({ showMobileTab = true }: NavAppsButtonProps = {}) {
    const { openLaunchpad } = useLaunchpad();

    /* Gate the sparkle animation to the Studio page only. Everywhere
       else the icon is static — the sparkle is a "welcome to your
       projects hub" beat, not a global decoration. Matched by prefix
       so `/studio`, `/studio/archived`, etc. all qualify. */
    const pathname = usePathname();
    const shouldAnimate = pathname?.startsWith("/studio") ?? false;

    /* Bumping `starKey` remounts the sparkle SVG, which restarts its CSS
       animation. The 100ms delay matches the StudioMockup section — it
       gives the DOM a beat to commit before the animation runs, so the
       motion is visible from frame one instead of racing first paint
       (which is what was making the animation appear "broken").
       Only schedule the bump on Studio routes — see `shouldAnimate`. */
    const [starKey, setStarKey] = useState(0);
    useEffect(() => {
        if (!shouldAnimate) return;
        const id = window.setTimeout(() => setStarKey((k) => k + 1), 100);
        return () => window.clearTimeout(id);
    }, [shouldAnimate]);

    return (
        <>
            {/* Mobile tab — opens the Launchpad. */}
            {showMobileTab && (
                <button
                    type="button"
                    onClick={openLaunchpad}
                    className="relative flex flex-col items-center justify-center w-[25%] h-full gap-1 sm:hidden group"
                    aria-label="Apps"
                >
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="group-hover:stroke-white transition-colors"
                    >
                        <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
                    </svg>
                    <span className="text-[11px] font-medium text-[#e5e7eb] group-hover:text-white transition-colors">
                        Apps
                    </span>
                </button>
            )}

            {/* Desktop — search-field-style trigger. Clicking opens the
                Launchpad modal; typing happens inside the modal once it's
                open. */}
            <button
                type="button"
                onClick={openLaunchpad}
                className="hidden sm:flex items-center gap-2.5 h-10 w-[240px] px-3 rounded-[10px] border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/[0.18] transition-colors text-left"
                aria-label="Open Launchpad"
                title="Open Launchpad"
            >
                <svg
                    key={starKey}
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`${shouldAnimate ? "nav-star-twinkle " : ""}text-white/60 flex-shrink-0`}
                    aria-hidden="true"
                >
                    <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
                </svg>
                <span className="flex-1 text-sm text-white/45 truncate">
                    Search apps & destinations…
                </span>
            </button>
        </>
    );
}
