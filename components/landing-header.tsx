/**
 * LandingHeader — google-one-next Header port for `/`.
 *
 * Verbatim port of the source component (sticky top bar, burger +
 * slide-in mobile menu, scroll-driven hide via `NavScrollState`),
 * but with Film-maker's existing right-side button (NavProfileMenu
 * when signed in, sign-in link otherwise) substituted for the
 * source's "Sign up" CTA.
 *
 * Server component — reads session and balance for the profile menu,
 * then hands the rendered button to the client `<LandingHeaderShell>`
 * so mobile-menu state can live on the client.
 */

import Link from "next/link";

import { getSession } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { isFreePlan } from "@/lib/constants";

import { LandingHeaderShell } from "./landing-header-shell";
import { NavProfileMenu } from "./nav-profile-menu";
import { NavScrollState } from "./nav-scroll-state";

const NAV_LINKS = [
    { label: "Artistic Intelligence", href: "/pricing", active: true },
] as const;

export async function LandingHeader() {
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

    const rightSlot = user ? (
        <NavProfileMenu
            name={user.name ?? ""}
            email={user.email}
            credits={totalCredits}
            planName={planLabel}
            isFreePlan={onFreePlan}
            variant="avatar"
        />
    ) : (
        <Link
            href="/login"
            className="flex items-center justify-center h-10 px-4 rounded-xl bg-white text-black hover:bg-neutral-200 transition-colors text-sm font-semibold"
            aria-label="Sign in"
        >
            Sign in
        </Link>
    );

    return (
        <>
            <NavScrollState />

            <header
                id="app-nav-root"
                className="header header-theme-dark header-root"
                role="banner"
            >
                <LandingHeaderShell navLinks={NAV_LINKS} rightSlot={rightSlot} />
            </header>
        </>
    );
}
