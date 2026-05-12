/**
 * EditorHeaderAuthSlot — auth-aware right cluster for the editor header.
 *
 * Server component. Reads the session once at request time and renders
 * one of two states:
 *
 *   • Anonymous → "Sign in" link + "Get started" pill, mirroring the
 *     Film-maker landing CTAs (links to /login and /pricing respectively).
 *   • Signed-in → "Studio" link + an avatar pill that opens the standard
 *     profile menu via NavProfileMenu.
 *
 * Lives next to EditorHeader.tsx (its only consumer) rather than the
 * shared components/ root because the markup is editor-header-specific
 * (the pill shape, spacing, and border treatment match the rest of the
 * editor's chrome).
 */

import Link from "next/link";

import { getSession } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { isFreePlan } from "@/lib/constants";
import { CreditHydrator } from "@/lib/credit-store";
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
            {/* Seed the credit store so any client consumer in the editor
                (e.g. future credit-gated export) sees the canonical value. */}
            <CreditHydrator credits={totalCredits} />

            <Link
                href="/studio"
                className="hidden sm:inline-flex items-center rounded-md border border-white/[0.18] px-4 py-1.5 text-[13px] sm:text-[14px] font-medium text-white hover:bg-white/[0.05] transition-colors"
            >
                Studio
            </Link>

            <NavProfileMenu
                name={user.name ?? ""}
                email={user.email}
                credits={totalCredits}
                planName={planLabel}
                isFreePlan={onFreePlan}
            />
        </>
    );
}

function AnonymousCtas() {
    return (
        <>
            <Link
                href="/login"
                className="inline-flex items-center rounded-md border border-white/[0.18] px-3 py-1.5 sm:px-5 sm:py-2 text-[13px] sm:text-[14px] font-medium text-white hover:bg-white/[0.05] transition-colors"
            >
                Sign in
            </Link>
            <Link
                href="/pricing"
                className="inline-flex items-center rounded-md bg-white px-3 py-1.5 sm:px-5 sm:py-2 text-[13px] sm:text-[14px] font-semibold text-black hover:bg-neutral-200 transition-colors"
            >
                Get started
            </Link>
        </>
    );
}
