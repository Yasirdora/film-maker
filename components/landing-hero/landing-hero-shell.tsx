"use client";

/**
 * LandingPageShell — the only client component in the landing page's
 * composition layer. It exists for two reasons:
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

import { ClapperboardLoader } from "./clapperboard-loader";
import { useLoaderPhase, useRevealOnScroll } from "./hooks";
import { RevealProvider } from "./reveal-context";
import styles from "./landing-hero.module.css";

interface LandingPageShellProps {
    children: ReactNode;
}

export function LandingPageShell({ children }: LandingPageShellProps) {
    const loader = useLoaderPhase();
    const reveal = useRevealOnScroll(loader.mainInteractive);

    // The loader is a fullscreen overlay (opaque `--lp-bg`, z-index 10000)
    // that visually covers the page until its fade-out begins, so `<main>`
    // is allowed to paint immediately underneath it. Keeping the hero in
    // the render tree from first paint is what lets the browser fire LCP
    // at ~1.2 s instead of waiting on the loader's 3 s state machine —
    // users still see the same pulse → clap → fade-out reveal because the
    // overlay sits above. `inert` keeps focus and pointer events trapped
    // outside the page until the loader hands off.
    return (
        <>
            <ClapperboardLoader phase={loader.phase} />

            <main className={styles.page} inert={!loader.mainInteractive}>
                <RevealProvider value={reveal}>{children}</RevealProvider>
            </main>
        </>
    );
}
