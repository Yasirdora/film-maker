/**
 * AppHeader — shared top-of-page header for every interior app page
 * (studio, pricing, auteur, project workspace).
 *
 * Pairs the AppBrandMark at a consistent size and position so the
 * top-left "home" affordance looks the same everywhere. Reserves
 * right padding on desktop (`sm:pr-64`) so the content inside never
 * collides with the fixed AppNav cluster anchored top-right.
 *
 * Children render inline after the brand mark for pages that need
 * additional title or action UI in the same row (e.g. the project
 * workspace embeds ProjectSettings here).
 */

import type { ReactNode } from "react";

import { AppBrandMark } from "./app-brand-mark";

interface AppHeaderProps {
    /** Where the brand mark links to. Omit on /studio itself so the
     *  click just replays the clap animation. */
    brandHref?: string;
    /** Reserve right padding on desktop so the absolute AppNav cluster
     *  can't overlap inline children. Disable on pages that don't
     *  render AppNav (e.g. logged-out /pricing). */
    reserveNavSpace?: boolean;
    children?: ReactNode;
}

export function AppHeader({
    brandHref,
    reserveNavSpace = true,
    children,
}: AppHeaderProps) {
    return (
        <header
            className={`sticky top-0 z-50 flex shrink-0 items-center gap-3 px-4 pt-4 pb-2 pointer-events-none sm:gap-4 sm:px-6 sm:pb-3 ${
                reserveNavSpace ? "sm:pr-64" : ""
            }`}
        >
            <div className="pointer-events-auto">
                <AppBrandMark href={brandHref} size="sm" />
            </div>
            {children && <div className="pointer-events-auto flex items-center gap-3">{children}</div>}
        </header>
    );
}
