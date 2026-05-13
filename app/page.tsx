/**
 * Landing page — public, waitlist-gated.
 *
 * Thin server wrapper around <LandingPage>. Its only job is to read
 * environment-sourced config (the Turnstile site key) and hand it to
 * the client component; all presentation lives under
 * components/landing-hero/.
 */

import type { Metadata } from "next";

import { AppNav } from "@/components/app-nav";
import { LandingPage } from "@/components/landing-hero/landing-hero";

// ─── SEO ──────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
    title: "Film-maker — Artistic Intelligence for Filmmakers",
    description:
        "Create cinematic content with AI tools designed by and for filmmakers. " +
        "Join the private beta today.",
};

// ─── Config ───────────────────────────────────────────────────────────────────

// Empty string disables Turnstile on the client — acceptable in dev, but
// a hard signal in production that the key is misconfigured.
const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY ?? "";

if (!turnstileSiteKey) {
    // This runs at build/server startup — it appears in terminal /
    // deployment logs only (server components execute on the server).
    const msg =
        "[Film-maker] TURNSTILE_SITE_KEY is not set — bot protection is disabled.";
    if (process.env.NODE_ENV === "production") {
        console.error(msg);
    } else {
        console.warn(msg);
    }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
    return (
        <>
            {/* Same global nav as every interior page (top bar + mobile
                bottom tab). NavScrollState (mounted inside AppNav) toggles
                `y:scrolled` / `dir:down` classes on `#app-nav-root`; the
                landing-page auto-hide rule in `globals.css` (gated on
                `body:has(.jumplinks.sticky:active)`) drives the slide-up
                when the StickyNav pill is pinned and the user scrolls
                downward. */}
            <AppNav />
            <LandingPage turnstileSiteKey={turnstileSiteKey} />
        </>
    );
}
