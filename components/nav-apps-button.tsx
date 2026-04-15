"use client";

/**
 * NavAppsButton — "Apps" trigger + Launchpad modal.
 *
 * Renders the Apps button in the nav (mobile tab + desktop pill).
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
                aria-label="Apps"
            >
                <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9ca3af"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="group-hover:stroke-white transition-colors"
                >
                    <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
                </svg>
                <span className="text-[10px] font-medium text-[#9ca3af] group-hover:text-white transition-colors">
                    Apps
                </span>
            </button>

            {/* Desktop pill */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="hidden sm:flex items-center gap-2 h-[34px] px-3.5 bg-white/[0.12] hover:bg-white/[0.2] rounded-lg transition-colors group"
                aria-label="Apps"
            >
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white/70 group-hover:text-white transition-colors"
                >
                    <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
                </svg>
                <span className="text-[13px] font-semibold text-white/90">
                    Apps
                </span>
            </button>

            {/* Launchpad modal */}
            <Launchpad open={open} onClose={() => setOpen(false)} />
        </>
    );
}
