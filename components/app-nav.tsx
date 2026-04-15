/**
 * AppNav — app-wide navigation.
 *
 * Mobile: fixed bottom tab bar (Auteur, Apps, Projects, Profile).
 * Desktop: fixed top-right cluster (Apps pill, Projects icon, Profile avatar).
 *
 * The "Apps" button opens the Launchpad (Spotlight-style command
 * palette) for quick navigation to any destination.
 *
 * Server component — reads session and balance for the profile menu.
 * Client interactivity delegated to NavAppsButton and NavProfileMenu.
 */

import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { isFreePlan } from "@/lib/constants";
import { NavAppsButton } from "./nav-apps-button";
import { NavProfileMenu } from "./nav-profile-menu";

export async function AppNav() {
    const { user } = await requireOnboardedUser();
    const balance = await getBalance(user.id);
    const totalCredits =
        balance.subscriptionCredits + balance.purchasedCredits;
    const planLabel =
        balance.plan.charAt(0).toUpperCase() + balance.plan.slice(1);
    const onFreePlan = isFreePlan(balance.plan);

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 flex h-[66px] shrink-0 items-center justify-around bg-[#0f0f11] px-1 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] sm:absolute sm:bottom-auto sm:left-auto sm:top-0 sm:right-0 sm:h-auto sm:w-auto sm:justify-end sm:gap-1.5 sm:bg-transparent sm:px-6 sm:pt-4 sm:pb-4 sm:shadow-none"
            aria-label="Main Navigation"
        >
            {/* Auteur — mobile only */}
            <Link
                href="/auteur"
                className="relative flex flex-col items-center justify-center w-[25%] h-full gap-1 sm:hidden group"
                aria-label="Auteur"
            >
                <svg
                    width="22"
                    height="22"
                    viewBox="0 0 19.5 19.5"
                    fill="none"
                    className="group-hover:stroke-white transition-colors"
                >
                    <path
                        d="M13.75 0.75H5.75C2.98858 0.75 0.75 2.98858 0.75 5.75V13.75C0.75 16.5114 2.98858 18.75 5.75 18.75H13.75C16.5114 18.75 18.75 16.5114 18.75 13.75V5.75C18.75 2.98858 16.5114 0.75 13.75 0.75Z"
                        stroke="#9ca3af"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <rect x="5.75" y="6.75" width="2" height="6" rx="1" fill="#9ca3af" className="group-hover:fill-white transition-colors" />
                    <rect x="11.75" y="6.75" width="2" height="6" rx="1" fill="#9ca3af" className="group-hover:fill-white transition-colors" />
                </svg>
                <span className="text-[10px] font-medium text-[#9ca3af] group-hover:text-white transition-colors">
                    Auteur
                </span>
            </Link>

            {/* Apps — opens Launchpad (client component) */}
            <NavAppsButton />

            {/* Projects (mobile) / Auteur (desktop) */}
            <Link
                href="/studio"
                className="relative flex flex-col items-center justify-center w-[25%] h-full gap-1 sm:hidden group"
                aria-label="Projects"
            >
                <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9ca3af"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="group-hover:stroke-white transition-colors"
                >
                    <rect x="3" y="3" width="7" height="18" rx="1.5" />
                    <rect x="14" y="3" width="7" height="8" rx="1.5" />
                    <rect x="14" y="15" width="7" height="6" rx="1.5" />
                </svg>
                <span className="text-[10px] font-medium text-[#9ca3af] group-hover:text-white transition-colors">
                    Projects
                </span>
            </Link>
            <Link
                href="/auteur"
                className="relative hidden sm:flex items-center justify-center w-[34px] h-[34px] rounded-[10px] hover:bg-white/5 group"
                aria-label="Auteur"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 19.5 19.5"
                    fill="none"
                    className="group-hover:stroke-white transition-colors"
                >
                    <path
                        d="M13.75 0.75H5.75C2.99 0.75 0.75 2.99 0.75 5.75V13.75C0.75 16.51 2.99 18.75 5.75 18.75H13.75C16.51 18.75 18.75 16.51 18.75 13.75V5.75C18.75 2.99 16.51 0.75 13.75 0.75Z"
                        stroke="#9ca3af"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <rect x="5.75" y="6.75" width="2" height="6" rx="1" fill="#9ca3af" className="group-hover:fill-white transition-colors" />
                    <rect x="11.75" y="6.75" width="2" height="6" rx="1" fill="#9ca3af" className="group-hover:fill-white transition-colors" />
                </svg>
            </Link>

            {/* Profile — mobile bottom sheet, desktop dropdown */}
            <NavProfileMenu
                name={user.name ?? ""}
                email={user.email}
                credits={totalCredits}
                planName={planLabel}
                isFreePlan={onFreePlan}
            />
        </nav>
    );
}
