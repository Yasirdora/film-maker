/**
 * AppNav — shared navigation bar for authenticated pages.
 *
 * Fixed top bar with: clapperboard logo → spacer → credits → user menu.
 * Glassmorphic background with backdrop blur. Same structure on mobile
 * and desktop — no hamburger, all elements stay visible.
 *
 * Server component — reads session and balance. Client interactivity
 * (sign-out, dropdown) is delegated to NavUserMenu.
 */

import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { isFreePlan } from "@/lib/constants";
import { ClapperboardIcon } from "./icons/clapperboard-icon";
import { NavUserMenu } from "./nav-user-menu";

export async function AppNav() {
    const { user } = await requireOnboardedUser();
    const balance = await getBalance(user.id);
    const totalCredits =
        balance.subscriptionCredits + balance.purchasedCredits;
    const planLabel =
        balance.plan.charAt(0).toUpperCase() + balance.plan.slice(1);
    const onFreePlan = isFreePlan(balance.plan);

    return (
        <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0f0f11]/80 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-6">
                {/* Clapperboard logo */}
                <Link
                    href="/studio"
                    className="flex items-center justify-center rounded-lg p-1 transition-colors hover:bg-white/[0.06]"
                    aria-label="Film-maker home"
                >
                    <ClapperboardIcon
                        className="h-8 w-auto text-white sm:h-9"
                    />
                </Link>

                <div className="flex-1" />

                {/* Credits button */}
                <Link
                    href="/credits"
                    className="flex h-9 items-center justify-center rounded-lg px-1 transition-colors hover:bg-white/[0.06]"
                    title={`${Intl.NumberFormat("en-US").format(totalCredits)} credits`}
                    aria-label={`${totalCredits} credits`}
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[#9ca3af] transition-colors hover:text-white"
                        aria-hidden
                    >
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                </Link>

                {/* User menu */}
                <NavUserMenu
                    name={user.name ?? ""}
                    email={user.email}
                    credits={totalCredits}
                    planName={planLabel}
                    isFreePlan={onFreePlan}
                />
            </div>
        </nav>
    );
}
