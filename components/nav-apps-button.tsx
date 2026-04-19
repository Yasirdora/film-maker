"use client";

/**
 * NavAppsButton — "Get Started" trigger + Launchpad modal.
 *
 * Renders the Launchpad trigger in the nav (mobile tab + desktop pill).
 * Clicking it opens the Launchpad command palette. Cmd+K / Ctrl+K
 * also toggles it from anywhere in the app.
 */

import { Launchpad, useLaunchpadShortcut } from "./launchpad";

export function NavAppsButton() {
    const [open, setOpen] = useLaunchpadShortcut();

    return (
        <>
            {/* Mobile tab */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="relative flex flex-col items-center justify-center w-[25%] h-full gap-1 sm:hidden group"
                aria-label="Get Started"
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
                    Get Started
                </span>
            </button>

            {/* Desktop pill — golden-yellow CTA */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="hidden sm:flex items-center gap-2 h-10 px-4 rounded-[10px] bg-amber-400 text-neutral-950 hover:bg-amber-300 transition-colors"
                aria-label="Get Started"
                title="Get Started (⌘K)"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
                </svg>
                <span className="text-sm font-semibold">Get Started</span>
            </button>

            {/* Launchpad modal */}
            <Launchpad open={open} onClose={() => setOpen(false)} />
        </>
    );
}
