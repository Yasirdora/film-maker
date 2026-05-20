"use client";

/**
 * LandingBrandMark — clapperboard logo for the landing page.
 *
 * Static SVG mark. Larger than the auth card version
 * to serve as the hero mark.
 */

import { ClapperboardIcon } from "@/components/icons/clapperboard-icon";

export function LandingBrandMark() {
    return (
        <div
            className="inline-flex cursor-default border-none bg-transparent p-0"
            aria-label="Film-maker"
        >
            <ClapperboardIcon
                className="h-auto w-16 overflow-visible text-white opacity-80"
                style={{ filter: "var(--brand-icon-shadow)" }}
            />
        </div>
    );
}
