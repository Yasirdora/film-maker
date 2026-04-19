/**
 * Landing page — waitlist-gated early access.
 *
 * Always-dark cinematic aesthetic. Clapperboard logo, brand tagline,
 * waitlist email capture, and footer. Fonts loaded at page level so
 * they don't bloat the root layout.
 */

import Link from "next/link";
import { Newsreader } from "next/font/google";
import { LandingBrandMark } from "./landing-brand-mark";
import { FilmmakerLogo } from "@/components/icons/filmmaker-logo";
import { WaitlistForm } from "./waitlist-form";

const newsreader = Newsreader({
    subsets: ["latin"],
    style: ["italic"],
    variable: "--font-newsreader",
});

export default async function HomePage() {
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
                    Film-maker is an AI creative studio for generating
                    cinematic images and video from text prompts. Sign in
                    with a one-time code sent to your email, organize your
                    work into projects, and iterate with precise creative
                    control. We&rsquo;re opening access to a select cohort
                    of creators while we scale — join the waiting list
                    below.
                </p>

                <div className="mt-10 w-full">
                    <WaitlistForm
                        turnstileSiteKey={process.env.TURNSTILE_SITE_KEY ?? ""}
                    />
                </div>
            </div>

            <footer className="absolute bottom-6 z-10 flex flex-col items-center gap-2 text-xs text-white/40 sm:flex-row sm:gap-6">
                <span>&copy; {year} Film-maker</span>
                <nav className="flex items-center gap-4">
                    <Link
                        href="/privacy"
                        className="transition-colors hover:text-white/80"
                    >
                        Privacy
                    </Link>
                    <Link
                        href="/terms"
                        className="transition-colors hover:text-white/80"
                    >
                        Terms
                    </Link>
                    <Link
                        href="/login"
                        className="transition-colors hover:text-white/80"
                    >
                        Sign in
                    </Link>
                </nav>
            </footer>
        </div>
    );
}
