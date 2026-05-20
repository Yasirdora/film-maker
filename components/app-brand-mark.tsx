"use client";

/**
 * AppBrandMark — compact clapperboard used across the app interior
 * (studio, project workspace, auteur, etc.).
 */

import Link from "next/link";

import { ClapperboardIcon } from "@/components/icons/clapperboard-icon";

interface AppBrandMarkProps {
    /** When set, the mark becomes a link to this route (typically
     *  "/studio" for home-style navigation). */
    href?: string;
    /** Visual size. `default` pairs with the big welcome heading on
     *  /studio; `md` sits between default and sm for surfaces like
     *  the auteur sidebar header that want a slightly bolder brand
     *  presence; `sm` is tuned for dense headers like the project
     *  workspace; `xs` matches the global top-nav clapperboard
     *  (32 / 36 px) so brand marks across surfaces stay consistent. */
    size?: "default" | "md" | "sm" | "xs";
}

const SIZE_CLASSES: Record<NonNullable<AppBrandMarkProps["size"]>, string> = {
    default: "w-11 sm:w-[3.25rem]",
    md: "w-10 sm:w-12",
    sm: "w-9 sm:w-11",
    xs: "w-8 sm:w-9",
};

export function AppBrandMark({ href, size = "default" }: AppBrandMarkProps) {
    const className =
        "inline-flex shrink-0 cursor-pointer border-none bg-transparent p-0";
    const icon = (
        <ClapperboardIcon
            className={`h-auto overflow-visible text-white opacity-80 ${SIZE_CLASSES[size]}`}
        />
    );

    if (href) {
        return (
            <Link href={href} aria-label="Film-maker — home" className={className}>
                {icon}
            </Link>
        );
    }

    return (
        <button type="button" aria-label="Film-maker" className={className}>
            {icon}
        </button>
    );
}
