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

import { useLaunchpad } from "./launchpad-host";

interface NavAppsButtonProps {
    showMobileTab?: boolean;
}

export function NavAppsButton({ showMobileTab = true }: NavAppsButtonProps = {}) {
    const { openLaunchpad } = useLaunchpad();

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

            {/* Desktop — amber "Get Started" pill matching the
                landing page's primary hero CTA (#fbbf24, near-black
                text, #fcd34d on hover). Same colour story across the
                product so the primary action reads identically on the
                marketing site and inside the app. */}
            <button
                type="button"
                onClick={openLaunchpad}
                className="hidden sm:inline-flex items-center gap-2 h-10 px-3.5 rounded-[10px] bg-[#fbbf24] text-[#0a0a0a] hover:bg-[#fcd34d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fcd34d]/60 transition-colors"
                aria-label="Open Launchpad"
                title="Open Launchpad"
            >
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-[#0a0a0a] flex-shrink-0"
                    aria-hidden="true"
                >
                    <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
                </svg>
                <span className="text-sm font-semibold">
                    Get Started
                </span>
            </button>
        </>
    );
}
