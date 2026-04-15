/**
 * AppNav — shared navigation bar for authenticated pages.
 *
 * Renders a fixed top bar with: brand mark → spacer → Dashboard link →
 * credits badge → user menu (sign out). Collapses gracefully on mobile
 * (all elements stay visible — no hamburger, just smaller spacing).
 *
 * Server component — reads session and balance. Client interactivity
 * (sign-out, dropdown) is delegated to child components.
 */

import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { NavUserMenu } from "./nav-user-menu";

export async function AppNav() {
    const { user } = await requireOnboardedUser();
    const balance = await getBalance(user.id);
    const totalCredits =
        balance.subscriptionCredits + balance.purchasedCredits;

    return (
        <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0f0f11]/80 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
                {/* Brand */}
                <Link
                    href="/studio"
                    className="text-sm font-semibold tracking-tight text-white"
                >
                    Film-maker
                </Link>

                <div className="flex-1" />

                {/* Projects */}
                <Link
                    href="/studio"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-[#9ca3af] transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                    >
                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    </svg>
                    <span className="hidden sm:inline">Projects</span>
                </Link>

                {/* Credits badge */}
                <Link
                    href="/credits"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 text-sm tabular-nums text-[#9ca3af] transition-colors hover:border-white/[0.15] hover:text-white"
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                    >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M16 8h-6a2 2 0 100 4h4a2 2 0 110 4H8" />
                        <path d="M12 18V6" />
                    </svg>
                    {Intl.NumberFormat("en-US").format(totalCredits)}
                </Link>

                {/* User menu */}
                <NavUserMenu
                    name={user.name ?? ""}
                    email={user.email}
                />
            </div>
        </nav>
    );
}
