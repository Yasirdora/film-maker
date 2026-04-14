/**
 * Landing page — waitlist-gated early access.
 *
 * Always-dark cinematic aesthetic. Clapperboard logo, brand tagline,
 * waitlist email capture, and footer. Fonts loaded at page level so
 * they don't bloat the root layout.
 */

import { Newsreader } from "next/font/google";
import { requireSession } from "@/lib/auth-server";
import { LandingBrandMark } from "./landing-brand-mark";
import { FilmmakerLogo } from "@/components/icons/filmmaker-logo";
import { WaitlistForm } from "./waitlist-form";

const newsreader = Newsreader({
    subsets: ["latin"],
    style: ["italic"],
    variable: "--font-newsreader",
});

export default async function HomePage() {
    await requireSession();
    const year = new Date().getFullYear();

    return (
        <div
            className={`${newsreader.variable} relative grid min-h-dvh place-items-center overflow-hidden px-6 py-16 text-white`}
            style={{
                fontFamily: "var(--font-google-sans), system-ui, sans-serif",
                background: "var(--brand-gradient)",
            }}
        >
            {/* Subtle overlay for depth */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40"
            />

            <div className="absolute left-6 top-6 z-10">
                <LandingBrandMark />
            </div>

            <div className="relative z-10 flex max-w-2xl flex-col items-center text-center">
                <FilmmakerLogo
                    className="mx-auto block h-auto w-[clamp(200px,70vw,560px)]"
                />

                <h1
                    className="mt-10 text-[clamp(2.5rem,5vw,3.75rem)] font-normal italic leading-[1.1] tracking-tight"
                    style={{
                        fontFamily: "var(--font-newsreader), serif",
                        textShadow: "var(--brand-text-shadow)",
                    }}
                >
                    Artistic intelligence.
                </h1>

                <p
                    className="mt-6 max-w-lg text-[clamp(0.9375rem,1.5vw,1.125rem)] leading-relaxed text-white/70"
                    style={{ textShadow: "var(--brand-text-shadow-sm)" }}
                >
                    We&apos;re opening access to a select cohort of creators to
                    ensure infrastructure stability. Join the waiting list to
                    generate cinematic image and video with precision and creative
                    control.
                </p>

                <div className="mt-10 w-full">
                    <WaitlistForm
                        turnstileSiteKey={process.env.TURNSTILE_SITE_KEY ?? ""}
                    />
                </div>
            </div>

            <footer className="absolute bottom-6 z-10 text-xs text-white/30">
                &copy; {year} Film-maker
            </footer>
        </div>
    );
}
