/**
 * AppNav — app-wide navigation.
 *
 * Mobile: fixed bottom tab bar (Auteur, Apps, Projects, Profile).
 * Desktop: fixed top-right cluster (Auteur icon, Apps pill, Profile avatar).
 *
 * The "Apps" button opens the Launchpad (Spotlight-style command
 * palette) for quick navigation to any destination.
 *
 * Renders on every page — authenticated or not — so the shell looks
 * identical everywhere. Anonymous visitors get a Sign-in affordance
 * in place of the profile menu; auth-gated destinations rely on
 * per-page redirects (requireOnboardedUser) to bounce them to /login.
 *
 * Server component — reads session and balance for the profile menu.
 * Client interactivity delegated to NavAppsButton and NavProfileMenu.
 */

import Link from "next/link";
import { getSession } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { isFreePlan } from "@/lib/constants";
import { NavAppsButton } from "./nav-apps-button";
import { NavProfileMenu } from "./nav-profile-menu";
import { AuteurIcon } from "./icons/auteur-icon";

import styles from "./app-nav.module.css";

export async function AppNav() {
    const session = await getSession();
    const user = session?.user ?? null;

    const balance = user ? await getBalance(user.id) : null;
    const totalCredits = balance
        ? balance.subscriptionCredits + balance.purchasedCredits
        : 0;
    const planLabel = balance
        ? balance.plan.charAt(0).toUpperCase() + balance.plan.slice(1)
        : "";
    const onFreePlan = balance ? isFreePlan(balance.plan) : false;

    return (
        <>
            {/* Gradient blur scrims — fixed to the viewport so content
                scrolling underneath the nav is subtly blurred, fading
                into the page via a mask gradient. Ported from ConveX. */}
            <div
                className={`${styles.scrim} ${styles.scrimMobile}`}
                aria-hidden="true"
            />
            <div
                className={`${styles.scrim} ${styles.scrimDesktop}`}
                aria-hidden="true"
            />

            <nav
                className="fixed bottom-0 left-0 right-0 z-50 flex h-[calc(66px+env(safe-area-inset-bottom,0px))] shrink-0 items-center justify-around px-1 pb-[env(safe-area-inset-bottom,0px)] sm:bottom-auto sm:left-auto sm:top-0 sm:right-0 sm:h-auto sm:w-auto sm:justify-end sm:gap-1.5 sm:px-6 sm:pt-4 sm:pb-4"
                aria-label="Main Navigation"
            >
            {/* Auteur — mobile only */}
            <Link
                href="/auteur"
                className="relative flex flex-col items-center justify-center w-[25%] h-full gap-1 sm:hidden group text-[#e5e7eb] transition-colors hover:text-white"
                aria-label="Auteur"
            >
                <AuteurIcon />
                <span className="text-[11px] font-medium">Auteur</span>
            </Link>

            {/* Auteur — desktop only (mobile tab is above) */}
            {user && (
                <Link
                    href="/auteur"
                    className="relative hidden sm:flex items-center justify-center w-10 h-10 rounded-[10px] text-[#e5e7eb] transition-colors hover:bg-white/5 hover:text-white group"
                    aria-label="Auteur"
                >
                    <AuteurIcon />
                </Link>
            )}

            {/* Apps — opens Launchpad (client component) */}
            <NavAppsButton />

            {/* Projects — mobile only */}
            <Link
                href="/studio"
                className="relative flex flex-col items-center justify-center w-[25%] h-full gap-1 sm:hidden group"
                aria-label="Projects"
            >
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="group-hover:stroke-white transition-colors"
                >
                    <rect x="3" y="3" width="7" height="18" rx="1.5" />
                    <rect x="14" y="3" width="7" height="8" rx="1.5" />
                    <rect x="14" y="15" width="7" height="6" rx="1.5" />
                </svg>
                <span className="text-[11px] font-medium text-[#e5e7eb] group-hover:text-white transition-colors">
                    Projects
                </span>
            </Link>

            {/* Profile (signed in) — mobile bottom sheet, desktop dropdown.
                Sign-in CTA (signed out) — same slot, same shape, links to /login. */}
            {user ? (
                <NavProfileMenu
                    name={user.name ?? ""}
                    email={user.email}
                    credits={totalCredits}
                    planName={planLabel}
                    isFreePlan={onFreePlan}
                />
            ) : (
                <SignInSlot />
            )}
            </nav>
        </>
    );
}

function SignInSlot() {
    return (
        <>
            {/* Mobile tab */}
            <Link
                href="/login"
                className="flex flex-col items-center justify-center w-[25%] h-full gap-1 sm:hidden group"
                aria-label="Sign in"
            >
                <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-white/[0.07] border border-white/[0.08] group-hover:bg-white/[0.12] transition-colors">
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="group-hover:stroke-white transition-colors"
                    >
                        <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                </div>
                <span className="text-[11px] font-medium text-[#e5e7eb] group-hover:text-white transition-colors">
                    Sign in
                </span>
            </Link>

            {/* Desktop button */}
            <Link
                href="/login"
                className="hidden sm:flex items-center justify-center h-10 px-4 rounded-xl bg-white text-black hover:bg-neutral-200 transition-colors text-sm font-semibold"
                aria-label="Sign in"
            >
                Sign in
            </Link>
        </>
    );
}
