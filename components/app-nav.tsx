/**
 * AppNav — shared navigation bar for authenticated pages.
 *
 * Renders a fixed top bar with: brand mark → spacer → Create button →
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
        <nav className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/80">
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
                {/* Brand */}
                <Link
                    href="/dashboard"
                    className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-50"
                >
                    Film-maker
                </Link>

                <div className="flex-1" />

                {/* Create CTA */}
                <Link
                    href="/auteur"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-neutral-900 px-3.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                    >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span className="hidden sm:inline">Create</span>
                </Link>

                {/* Credits badge */}
                <Link
                    href="/credits"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-sm tabular-nums text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
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
