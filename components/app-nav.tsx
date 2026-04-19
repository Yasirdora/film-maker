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
                    width="26"
                    height="26"
                    viewBox="0 0 22 22"
                    fill="none"
                    className="group-hover:stroke-white transition-colors"
                >
                    <path
                        d="M15.5129 0.846191H6.48722C3.37337 0.846191 0.846191 3.37337 0.846191 6.48722V15.5129C0.846191 18.6267 3.37337 21.1539 6.48722 21.1539H15.5129C18.6267 21.1539 21.1539 18.6267 21.1539 15.5129V6.48722C21.1539 3.37337 18.6267 0.846191 15.5129 0.846191Z"
                        stroke="#9ca3af"
                        strokeWidth="1.69231"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path d="M8 9V13" stroke="#9ca3af" strokeWidth="2.25641" strokeLinecap="round" className="auteur-eye-open group-hover:stroke-[#d4d4d8] transition-colors" />
                    <path d="M14 9V13" stroke="#9ca3af" strokeWidth="2.25641" strokeLinecap="round" className="auteur-eye-open group-hover:stroke-[#d4d4d8] transition-colors" />
                    <path d="M8 10V11" stroke="#9ca3af" strokeWidth="2.25641" strokeLinecap="round" className="auteur-eye-closed group-hover:stroke-[#d4d4d8] transition-colors" />
                    <path d="M14 10V11" stroke="#9ca3af" strokeWidth="2.25641" strokeLinecap="round" className="auteur-eye-closed group-hover:stroke-[#d4d4d8] transition-colors" />
                </svg>
                <span className="text-[11px] font-medium text-[#9ca3af] group-hover:text-white transition-colors">
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
                    width="26"
                    height="26"
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
                <span className="text-[11px] font-medium text-[#9ca3af] group-hover:text-white transition-colors">
                    Projects
                </span>
            </Link>
            <Link
                href="/auteur"
                className="relative hidden sm:flex items-center justify-center w-10 h-10 rounded-[10px] hover:bg-white/5 group"
                aria-label="Auteur"
            >
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 22 22"
                    fill="none"
                    className="group-hover:stroke-white transition-colors"
                >
                    <path
                        d="M15.5129 0.846191H6.48722C3.37337 0.846191 0.846191 3.37337 0.846191 6.48722V15.5129C0.846191 18.6267 3.37337 21.1539 6.48722 21.1539H15.5129C18.6267 21.1539 21.1539 18.6267 21.1539 15.5129V6.48722C21.1539 3.37337 18.6267 0.846191 15.5129 0.846191Z"
                        stroke="#9ca3af"
                        strokeWidth="1.69231"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path d="M8 9V13" stroke="#9ca3af" strokeWidth="2.25641" strokeLinecap="round" className="auteur-eye-open group-hover:stroke-[#d4d4d8] transition-colors" />
                    <path d="M14 9V13" stroke="#9ca3af" strokeWidth="2.25641" strokeLinecap="round" className="auteur-eye-open group-hover:stroke-[#d4d4d8] transition-colors" />
                    <path d="M8 10V11" stroke="#9ca3af" strokeWidth="2.25641" strokeLinecap="round" className="auteur-eye-closed group-hover:stroke-[#d4d4d8] transition-colors" />
                    <path d="M14 10V11" stroke="#9ca3af" strokeWidth="2.25641" strokeLinecap="round" className="auteur-eye-closed group-hover:stroke-[#d4d4d8] transition-colors" />
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
