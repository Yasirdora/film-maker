"use client";

/**
 * LandingBrandMark — clapperboard logo for the landing page.
 *
 * Wraps the shared ClapperboardIcon with auto-clap on mount and
 * hover-to-clap interaction. Larger than the auth card version
 * to serve as the hero mark.
 */

import { useRef } from "react";
import {
    ClapperboardIcon,
    type ClapperboardIconHandle,
} from "@/components/icons/clapperboard-icon";

export function LandingBrandMark() {
    const clapperRef = useRef<ClapperboardIconHandle>(null);

    return (
        <button
            type="button"
            onClick={() => clapperRef.current?.clap()}
            onMouseEnter={() => clapperRef.current?.clap()}
            className="group cursor-pointer border-none bg-transparent p-0"
            aria-label="Film-maker"
        >
            <ClapperboardIcon
                ref={clapperRef}
                autoClap
                className="h-auto w-16 overflow-visible text-white opacity-80 transition-[transform,opacity] duration-[2500ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:scale-110 group-hover:opacity-100 group-hover:duration-300"
                style={{ filter: "var(--brand-icon-shadow)" }}
            />
        </button>
    );
}
