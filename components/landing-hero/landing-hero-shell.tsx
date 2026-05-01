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
 *
 * @deprecated Import from this file still works but the canonical
 * export name is now `LandingPageShell`. The old `LandingHeroShell`
 * alias is preserved for backward compatibility during migration.
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
    const phase = useLoaderPhase();
    const loaderDone = phase === "finished" || phase === "skipped";
    const reveal = useRevealOnScroll(loaderDone);

    return (
        <>
            <ClapperboardLoader phase={phase} />

            <main
                className={`${styles.page} ${
                    loaderDone ? styles.pageReady : styles.pageHidden
                }`}
                inert={!loaderDone || undefined}
            >
                <RevealProvider value={reveal}>{children}</RevealProvider>
            </main>
        </>
    );
}
