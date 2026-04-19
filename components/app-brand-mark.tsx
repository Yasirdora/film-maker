"use client";

/**
 * AppBrandMark — compact clapperboard used across the app interior
 * (studio, project workspace, auteur, etc.).
 *
 *   • Auto-claps once on mount.
 *   • Claps again on hover/focus and on click.
 *   • When `href` is provided it renders as a Link (Film-maker logo =
 *     "home" navigation pattern). Otherwise it's a button that simply
 *     re-plays the clap for users already on the home surface.
 *
 * The animation itself lives in `globals.css` as `.clapperboard-clap`;
 * this component is just the interaction + sizing layer.
 */

import Link from "next/link";
import { useRef } from "react";

import {
    ClapperboardIcon,
    type ClapperboardIconHandle,
} from "@/components/icons/clapperboard-icon";

interface AppBrandMarkProps {
    /** When set, the mark becomes a link to this route (typically
     *  "/studio" for home-style navigation). Omit on the studio page
     *  itself so clicking just replays the clap. */
    href?: string;
    /** Visual size. `default` pairs with the big welcome heading on
     *  /studio; `sm` is tuned for dense headers like the project
     *  workspace that carry smaller surrounding text. */
    size?: "default" | "sm";
}

const SIZE_CLASSES: Record<NonNullable<AppBrandMarkProps["size"]>, string> = {
    default: "w-10 sm:w-12",
    sm: "w-8 sm:w-10",
};

export function AppBrandMark({ href, size = "default" }: AppBrandMarkProps) {
    const clapperRef = useRef<ClapperboardIconHandle>(null);
    const clap = () => clapperRef.current?.clap();

    const sharedClassName =
        "group inline-flex shrink-0 cursor-pointer border-none bg-transparent p-0";
    const icon = (
        <ClapperboardIcon
            ref={clapperRef}
            autoClap
            className={`h-auto overflow-visible text-white opacity-80 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:scale-110 group-hover:opacity-100 ${SIZE_CLASSES[size]}`}
        />
    );

    if (href) {
        return (
            <Link
                href={href}
                onMouseEnter={clap}
                aria-label="Film-maker — home"
                className={sharedClassName}
            >
                {icon}
            </Link>
        );
    }

    return (
        <button
            type="button"
            onClick={clap}
            onMouseEnter={clap}
            aria-label="Film-maker"
            className={sharedClassName}
        >
            {icon}
        </button>
    );
}
