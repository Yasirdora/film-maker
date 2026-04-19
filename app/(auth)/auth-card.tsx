/**
 * AuthCard — shared two-pane cinematic card for all auth-flow pages.
 *
 * Layout: on desktop (≥860px) the card splits into a brand pane (left)
 * and a content pane (right). On mobile the brand pane stacks above.
 * The card uses glassmorphic styling, entrance animation, and the
 * project's brand fonts.
 *
 * Used by /login and /welcome to guarantee visual consistency across
 * the signup flow.
 */

import { Google_Sans, Newsreader } from "next/font/google";
import { BrandPane } from "./login/brand-pane";

const googleSans = Google_Sans({
    subsets: ["latin"],
    variable: "--font-google-sans",
});

const newsreader = Newsreader({
    subsets: ["latin"],
    style: ["italic"],
    variable: "--font-newsreader",
});

interface AuthCardProps {
    children: React.ReactNode;
}

export function AuthCard({ children }: AuthCardProps) {
    return (
        <div
            className={`${googleSans.variable} ${newsreader.variable} auth-card-entrance relative z-10 w-full max-w-[1040px] p-[clamp(1.5rem,3vw,2rem)]`}
            style={{ fontFamily: "var(--font-google-sans), system-ui, sans-serif" }}
        >
            <main
                className="isolate flex flex-col overflow-hidden rounded-3xl border border-[var(--border)] backdrop-blur-[20px] [transform:translateZ(0)] min-[860px]:flex-row"
                style={{
                    backgroundColor: "var(--card-bg)",
                    boxShadow: "var(--card-shadow)",
                }}
            >
                <BrandPane />

                <section className="relative flex flex-1 flex-col justify-center p-[clamp(1.5rem,3vw,2rem)] min-[860px]:p-[clamp(2rem,4vw,3rem)]">
                    {children}
                </section>
            </main>
        </div>
    );
}
