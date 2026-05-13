/**
 * AppNav — global app shell nav.
 *
 *   • Desktop & tablet: editor-style horizontal top bar (brand + nav
 *     dropdowns at lg+, right-cluster auth + Launchpad pill at sm+).
 *   • Mobile (< sm): bottom tab bar with Auteur, Apps (Launchpad),
 *     Projects, and Profile/Sign-in.
 *
 * Mounts on every interior page (studio, projects, pricing, auteur,
 * editor/*) so the chrome reads identically across the product. The
 * Launchpad itself is mounted once at the root by `LaunchpadHost`; all
 * trigger surfaces here just call into its context.
 *
 * Server component — reads session and balance for the profile menu.
 * Client interactivity is delegated to `EditorHeader` (dropdowns) and
 * `NavAppsButton` / `NavProfileMenu` (trigger UIs).
 */

import Link from "next/link";
import type { ReactNode } from "react";

import { getSession } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { isFreePlan } from "@/lib/constants";
import { CreditHydrator } from "@/lib/credit-store";
import { EditorHeader } from "./editor/EditorHeader";
import { EditorHeaderAuthSlot } from "./editor/EditorHeaderAuthSlot";
import { NavAppsButton } from "./nav-apps-button";
import { NavProfileMenu } from "./nav-profile-menu";
import { NavScrollState } from "./nav-scroll-state";
import { AuteurIcon } from "./icons/auteur-icon";

import styles from "./app-nav.module.css";

interface AppNavProps {
    /** Hide the bottom-tab Auteur icon — used on /auteur itself. */
    hideAuteurIcon?: boolean;
    /**
     * Skip rendering the desktop top bar entirely. The page is expected
     * to provide its own chrome (e.g. /auteur, which has a full-height
     * sidebar with its own branding and section nav). CreditHydrator
     * and the mobile bottom tab bar are still rendered so data seeding
     * and mobile-only navigation aren't lost.
     */
    hideTopBar?: boolean;
    /** Where the brand mark links to. Defaults to `/`. */
    brandHref?: string;
    /** Inline content rendered in the top bar between brand and nav. */
    children?: ReactNode;
}

export async function AppNav({
    hideAuteurIcon = false,
    hideTopBar = false,
    brandHref,
    children,
}: AppNavProps = {}) {
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
            {/* Seed the shared credit store so every client consumer
                (nav menu, workspace, composer) starts with the DB value. */}
            {balance && <CreditHydrator credits={totalCredits} />}

            {/* Mobile bottom-tab scrim — fades content scrolling
                under the tab bar, gives the monochrome icons a legible
                backdrop. Desktop no longer needs a top scrim because
                the new horizontal top bar provides its own surface. */}
            <div
                className={`${styles.scrim} ${styles.scrimMobile}`}
                aria-hidden="true"
            />

            <NavScrollState />

            {/* Top bar. Pages that own their full-screen chrome (e.g.
                /auteur with its sidebar + unified top bar) pass
                `hideTopBar` to suppress this entirely. Those pages are
                responsible for rendering their own auth slot. */}
            {!hideTopBar && (
                <EditorHeader
                    brandHref={brandHref}
                    rightSlot={<EditorHeaderAuthSlot />}
                >
                    {children}
                </EditorHeader>
            )}

            {/* Mobile bottom tab bar — sm:hidden. Provides flat
                top-level destinations + a Launchpad opener. */}
            <nav
                className="fixed bottom-0 left-0 right-0 z-50 flex h-[calc(66px+env(safe-area-inset-bottom,0px))] shrink-0 items-center justify-around px-1 pb-[env(safe-area-inset-bottom,0px)] sm:hidden"
                aria-label="Main Navigation"
            >
                {!hideAuteurIcon && (
                    <Link
                        href="/auteur"
                        className="relative flex flex-col items-center justify-center w-[25%] h-full gap-1 group text-[#e5e7eb] transition-colors hover:text-white"
                        aria-label="Auteur"
                    >
                        <AuteurIcon />
                        <span className="text-[11px] font-medium">Auteur</span>
                    </Link>
                )}

                <NavAppsButton />

                <Link
                    href="/studio"
                    className="relative flex flex-col items-center justify-center w-[25%] h-full gap-1 group"
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

                {user ? (
                    <NavProfileMenu
                        name={user.name ?? ""}
                        email={user.email}
                        credits={totalCredits}
                        planName={planLabel}
                        isFreePlan={onFreePlan}
                    />
                ) : (
                    <MobileSignInTab />
                )}
            </nav>
        </>
    );
}

function MobileSignInTab() {
    return (
        <Link
            href="/login"
            className="flex flex-col items-center justify-center w-[25%] h-full gap-1 group"
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
    );
}
