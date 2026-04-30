"use client";

/**
 * RevealContext — exposes the reveal controller created by
 * `useRevealOnScroll` to descendant client components.
 *
 * The provider lives on `<LandingHeroShell>`, which itself owns the
 * loader-phase state that "arms" the reveal observer. Consumers
 * (HeroContent, TaglineSection, future reveal targets) call
 * `useReveal()` to get the controller without having to receive it
 * through props from a server parent — server components can't pass
 * functions across the client boundary, so context is how the
 * RevealController crosses the gap.
 */

import { createContext, useContext } from "react";

import type { RevealController } from "./hooks";

const RevealContext = createContext<RevealController | null>(null);

export const RevealProvider = RevealContext.Provider;

/**
 * Read the reveal controller from context. Throws if called outside
 * `<LandingHeroShell>` so the missing-provider failure is loud and
 * obvious instead of silently producing a no-op reveal.
 */
export function useReveal(): RevealController {
    const ctx = useContext(RevealContext);
    if (!ctx) {
        throw new Error(
            "useReveal must be used inside <LandingHeroShell>. " +
                "Reveal targets must render under the landing-hero shell.",
        );
    }
    return ctx;
}
