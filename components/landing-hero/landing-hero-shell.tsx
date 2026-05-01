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
import clsx from "clsx";

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

    // Loader is rendered unconditionally so server and client agree at
    // hydration time. The `loaderOverlaySkipped` CSS class hides it
    // instantly (no transition) for repeat / reduced-motion visitors,
    // so the cost of the always-mounted SVG is just one inert overlay
    // node — not a visible flash.
    return (
        <>
            <ClapperboardLoader phase={loader.phase} />

            <main
                className={clsx(
                    styles.page,
                    loader.mainInteractive ? styles.pageReady : styles.pageHidden,
                )}
                inert={!loader.mainInteractive}
            >
                <RevealProvider value={reveal}>{children}</RevealProvider>
            </main>
        </>
    );
}
