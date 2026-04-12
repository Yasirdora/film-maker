"use client";

/**
 * BrandPane — left side of the auth card.
 *
 * Hosts the animated clapperboard wordmark and the cinematic tagline. The
 * background is a radial gradient placeholder; drop a file at
 * `public/assets/signin-hero.mp4` and replace the gradient div with a
 * `<video>` to enable the hero motion.
 *
 * Client component because the clapperboard exposes an imperative `clap()`
 * handle that we trigger on hover for an extra beat of life.
 */

import Link from "next/link";
import { useRef } from "react";
import {
    ClapperboardIcon,
    type ClapperboardIconHandle,
} from "@/components/icons/clapperboard-icon";

export function BrandPane() {
    const clapperRef = useRef<ClapperboardIconHandle>(null);

    return (
        <aside className="relative flex flex-1 flex-col justify-between overflow-hidden border-b border-[var(--border)] p-[clamp(1.5rem,3vw,2rem)] min-[860px]:min-h-[560px] min-[860px]:border-b-0 min-[860px]:border-r">
            {/* Cinematic gradient backdrop — swap for <video src="/assets/signin-hero.mp4" /> when the asset lands. */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-0"
                style={{ background: "var(--brand-gradient)" }}
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/10 to-black/90"
            />

            <Link
                href="/"
                className="group relative z-[2] -ml-2 flex w-fit cursor-pointer items-center text-white"
                onMouseEnter={() => clapperRef.current?.clap()}
                aria-label="Go to home"
            >
                <ClapperboardIcon
                    ref={clapperRef}
                    autoClap
                    className="h-auto w-11 overflow-visible opacity-70 transition-[transform,opacity] duration-[2500ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:scale-110 group-hover:opacity-100 group-hover:duration-300"
                    style={{ filter: "var(--brand-icon-shadow)" }}
                />
            </Link>

            <div className="relative z-[2] mt-[clamp(8rem,16vw,12rem)] hidden min-[860px]:block">
                <h2
                    className="text-[clamp(2rem,3.5vw,2.75rem)] font-normal italic leading-[1.1] tracking-tight text-white"
                    style={{
                        fontFamily: "var(--font-newsreader), serif",
                        textShadow: "var(--brand-text-shadow)",
                    }}
                >
                    Artistic intelligence.
                </h2>
                <p
                    className="mt-2 text-[clamp(0.7rem,0.85vw,0.8rem)] font-normal tracking-[0.15em] text-white/85"
                    style={{ textShadow: "var(--brand-text-shadow-sm)" }}
                >
                    ONE TOOL. EVERY FRAME.
                </p>
            </div>
        </aside>
    );
}
