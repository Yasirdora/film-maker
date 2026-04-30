"use client";

/**
 * LandingHeroShell — the only client component in the landing-hero
 * tree's composition layer. It exists for two reasons:
 *
 *   1. Owns the loader phase (`useLoaderPhase`) and the reveal
 *      controller (`useRevealOnScroll`), which need to live in the
 *      browser.
 *   2. Renders the `<ClapperboardLoader>` overlay and the gated
 *      `<main>` element that wraps the rest of the page.
 *
 * Server-rendered content flows through via `children`. RSC allows
 * server components to be passed as children of a client component,
 * so the bulk of the landing tree stays on the server while only the
 * genuinely interactive pieces get bundled to the client.
 */

import type { ReactNode } from "react";
import { Newsreader } from "next/font/google";

import { ClapperboardLoader } from "./clapperboard-loader";
import { useLoaderPhase, useRevealOnScroll } from "./hooks";
import { RevealProvider } from "./reveal-context";
import styles from "./landing-hero.module.css";

const newsreader = Newsreader({
    subsets: ["latin"],
    style: ["italic"],
    variable: "--font-newsreader",
    display: "swap",
});

interface LandingHeroShellProps {
    children: ReactNode;
}

export function LandingHeroShell({ children }: LandingHeroShellProps) {
    const phase = useLoaderPhase();
    const loaderDone = phase === "finished" || phase === "skipped";
    const reveal = useRevealOnScroll(loaderDone);

    return (
        <>
            <ClapperboardLoader phase={phase} />

            <main
                className={`${newsreader.variable} ${styles.page} ${
                    loaderDone ? styles.pageReady : styles.pageHidden
                }`}
                inert={!loaderDone || undefined}
            >
                <RevealProvider value={reveal}>{children}</RevealProvider>
            </main>
        </>
    );
}
