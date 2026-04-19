/**
 * Landing page — public, waitlist-gated.
 *
 * Thin server wrapper around <LandingHero>. Its only job is to read
 * environment-sourced config (the Turnstile site key) and hand it to
 * the client component; all presentation lives under
 * components/landing-hero/.
 */

import { AppNav } from "@/components/app-nav";
import { LandingHero } from "@/components/landing-hero/landing-hero";

export default function HomePage() {
    return (
        <>
            <AppNav />
            <LandingHero
                turnstileSiteKey={process.env.TURNSTILE_SITE_KEY ?? ""}
            />
        </>
    );
}
