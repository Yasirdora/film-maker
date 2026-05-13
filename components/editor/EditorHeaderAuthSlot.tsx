/**
 * EditorHeaderAuthSlot — auth-aware right cluster for the global top bar.
 *
 * Server component. Reads the session once at request time and renders
 * one of two states (sm+ only — the mobile bottom tab bar in AppNav
 * carries the same actions at < sm):
 *
 *   • Anonymous → "Sign in" link + "Get started" pill.
 *   • Signed-in → Launchpad pill + avatar dropdown.
 *
 * The Launchpad and profile triggers render only at `sm+` so they
 * don't double up with the mobile bottom tab's entries.
 */

import Link from "next/link";

import { getSession } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { isFreePlan } from "@/lib/constants";
import { NavAppsButton } from "@/components/nav-apps-button";
import { NavProfileMenu } from "@/components/nav-profile-menu";

export async function EditorHeaderAuthSlot() {
    const session = await getSession();
    const user = session?.user ?? null;

    if (!user) return <AnonymousCtas />;

    const balance = await getBalance(user.id);
    const totalCredits =
        balance.subscriptionCredits + balance.purchasedCredits;
    const planLabel =
        balance.plan.charAt(0).toUpperCase() + balance.plan.slice(1);
    const onFreePlan = isFreePlan(balance.plan);

    return (
        <>
            {/* Launchpad pill — `showMobileTab={false}` so the mobile
                tab variant isn't rendered inside the header (the bottom
                tab bar already provides it). The desktop pill is
                `hidden sm:flex` internally, so nothing shows at <sm. */}
            <NavAppsButton showMobileTab={false} />

            {/* Profile avatar — `hidden sm:block` keeps the mobile tab
                bar's profile entry from being doubled at <sm. */}
            <div className="hidden sm:block">
                <NavProfileMenu
                    name={user.name ?? ""}
                    email={user.email}
                    credits={totalCredits}
                    planName={planLabel}
                    isFreePlan={onFreePlan}
                    variant="avatar"
                />
            </div>
        </>
    );
}

function AnonymousCtas() {
    return (
        <>
            <Link
                href="/login"
                className="hidden sm:inline-flex items-center rounded-md border border-white/[0.18] px-3 py-1.5 sm:px-5 sm:py-2 text-[13px] sm:text-[14px] font-medium text-white hover:bg-white/[0.05] transition-colors"
            >
                Sign in
            </Link>
            <Link
                href="/pricing"
                className="hidden sm:inline-flex items-center rounded-md bg-white px-3 py-1.5 sm:px-5 sm:py-2 text-[13px] sm:text-[14px] font-semibold text-black hover:bg-neutral-200 transition-colors"
            >
                Get started
            </Link>
        </>
    );
}
