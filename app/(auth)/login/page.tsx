/**
 * Login page — two-pane cinematic card.
 *
 * Layout: on desktop (≥860px) the card splits into a brand pane (left)
 * and an interaction pane (right). On mobile the brand pane stacks
 * above the form. The card itself is a rounded, bordered, glassy
 * surface that animates in on mount.
 *
 * The brand pane is designed to host a looping background video. No
 * asset ships today, so it falls back to a cinematic radial gradient —
 * drop a file at `public/assets/signin-hero.mp4` and replace the
 * `BrandPane` body with a `<video>` element to enable it.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Inter, Newsreader } from "next/font/google";
import { LoginForm } from "./login-form";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
});

const newsreader = Newsreader({
    subsets: ["latin"],
    style: ["italic"],
    variable: "--font-newsreader",
});

export const metadata: Metadata = {
    title: "Sign in",
    description: "Sign in to Film-maker",
};

function isEmailSignInAvailable(): boolean {
    return Boolean(
        process.env.GMAIL_CLIENT_ID &&
        process.env.GMAIL_CLIENT_SECRET &&
        process.env.GMAIL_REFRESH_TOKEN &&
        process.env.GMAIL_SENDER,
    );
}

export default function LoginPage() {
    const emailEnabled = isEmailSignInAvailable();

    return (
        <div
            className={`${inter.variable} ${newsreader.variable} auth-card-entrance relative z-10 w-full max-w-[1040px] p-[clamp(1.5rem,3vw,2rem)]`}
            style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
        >
            <main className="flex flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white/80 shadow-[0_24px_48px_rgba(0,0,0,0.08)] backdrop-blur-[20px] min-[860px]:flex-row dark:border-neutral-800 dark:bg-[rgba(18,18,20,0.65)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset,0_24px_48px_rgba(0,0,0,0.6),0_0_120px_rgba(0,85,255,0.1)]">
                <BrandPane />

                <section className="relative flex flex-1 flex-col justify-center p-[clamp(1.5rem,3vw,2rem)] min-[860px]:p-[clamp(2rem,4vw,3rem)]">
                    <Suspense fallback={null}>
                        <LoginForm emailEnabled={emailEnabled} />
                    </Suspense>
                </section>
            </main>
        </div>
    );
}

function BrandPane() {
    return (
        <aside className="relative flex flex-1 flex-col justify-between overflow-hidden border-b border-neutral-200 p-[clamp(1.5rem,3vw,2rem)] min-[860px]:min-h-[560px] min-[860px]:border-b-0 min-[860px]:border-r dark:border-neutral-800">
            {/* Cinematic gradient backdrop — swap for <video src="/assets/signin-hero.mp4" /> when the asset lands. */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-0"
                style={{
                    background:
                        "radial-gradient(120% 80% at 20% 10%, #1a1a2e 0%, #0a0a14 55%, #000000 100%)",
                }}
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/10 to-black/90"
            />

            <Link
                href="/"
                className="relative z-[2] w-fit text-sm font-semibold tracking-tight text-white/90 transition-opacity hover:opacity-100"
                aria-label="Go to home"
            >
                Film-maker
            </Link>

            <div className="relative z-[2] mt-[clamp(8rem,16vw,12rem)] hidden min-[860px]:block">
                <h2
                    className="text-[clamp(2rem,3.5vw,2.75rem)] font-normal italic leading-[1.1] tracking-tight text-white"
                    style={{
                        fontFamily: "var(--font-newsreader), serif",
                        textShadow: "0 4px 16px rgba(0,0,0,0.6)",
                    }}
                >
                    AI filmmaking,
                    <br />
                    simplified.
                </h2>
                <p
                    className="mt-2 text-[clamp(0.7rem,0.85vw,0.8rem)] font-normal tracking-[0.15em] text-white/85"
                    style={{ textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}
                >
                    ONE TOOL. EVERY FRAME.
                </p>
            </div>
        </aside>
    );
}
