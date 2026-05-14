"use client";

/**
 * ProjectViewTabs — segmented control for switching between the
 * project's Workspace (generation surface) and its Storyboard
 * (pre-production surface).
 *
 * Mounted by both `/projects/[uid]` and `/projects/[uid]/storyboard`
 * as the first row under the global top bar, so the segmented control
 * is in the same spot on both pages — the only thing that changes when
 * you click a tab is the body below.
 *
 * Implementation detail: each tab is a `next/link` (server-driven
 * navigation) — no client-side mount delay, no state. The active tab
 * is computed from `usePathname` against a stable suffix match.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
    projectUid: string;
}

export function ProjectViewTabs({ projectUid }: Props) {
    const pathname = usePathname() ?? "";
    const isStoryboard = pathname.endsWith("/storyboard");

    const tabs: { href: string; label: string; active: boolean }[] = [
        {
            href: `/projects/${projectUid}`,
            label: "Workspace",
            active: !isStoryboard,
        },
        {
            href: `/projects/${projectUid}/storyboard`,
            label: "Storyboard",
            active: isStoryboard,
        },
    ];

    return (
        <div className="flex shrink-0 border-b border-white/[0.04] bg-ws-canvas">
            <div className="mx-auto flex w-full max-w-[85rem] items-center gap-1 px-4 sm:px-6">
                {tabs.map((tab) => (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        prefetch
                        aria-current={tab.active ? "page" : undefined}
                        className={`relative inline-flex h-10 items-center px-3 text-sm font-medium transition-colors sm:text-[15px] ${
                            tab.active
                                ? "text-white"
                                : "text-ws-icon hover:text-white"
                        }`}
                    >
                        {tab.label}
                        {tab.active && (
                            <span
                                aria-hidden
                                className="absolute inset-x-3 -bottom-px h-[2px] bg-white"
                            />
                        )}
                    </Link>
                ))}
            </div>
        </div>
    );
}
