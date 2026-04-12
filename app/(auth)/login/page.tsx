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
import { Google_Sans, Newsreader } from "next/font/google";
import { LoginForm } from "./login-form";
import { BrandPane } from "./brand-pane";

const googleSans = Google_Sans({
    subsets: ["latin"],
    variable: "--font-google-sans",
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
            className={`${googleSans.variable} ${newsreader.variable} auth-card-entrance relative z-10 w-full max-w-[1040px] p-[clamp(1.5rem,3vw,2rem)]`}
            style={{ fontFamily: "var(--font-google-sans), system-ui, sans-serif" }}
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

