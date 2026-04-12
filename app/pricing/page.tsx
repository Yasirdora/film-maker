/**
 * Public pricing page.
 *
 * Server-rendered from SUBSCRIPTION_PLANS (the single source of truth in
 * lib/constants.ts). Reads the current session to decide which button
 * state to show on each card — signed-in users who are already on a plan
 * see "Current plan" instead of a CTA.
 *
 * Mobile-first: cards stack in a single column on phones, 2x2 on tablets,
 * 1x4 on desktop. Featured plan (Creator) gets a subtle highlight.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/constants";
import { getSession } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { cn } from "@/lib/utils";

import { UpgradeButton } from "./upgrade-button";

export const metadata: Metadata = {
    title: "Pricing",
    description:
        "Choose a Film-maker plan. Subscribe monthly or stay on the free Solo tier.",
};

export default async function PricingPage() {
    const session = await getSession();
    const currentPlan = session?.user
        ? (await getBalance(session.user.id))?.plan ?? "solo"
        : null;

    return (
        <main className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
            <header className="mx-auto max-w-6xl px-6 pt-12 pb-8 sm:pt-20 sm:pb-12">
                <Link
                    href="/"
                    className="text-sm font-semibold tracking-tight text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
                >
                    ← Film-maker
                </Link>
                <h1 className="mt-8 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-5xl dark:text-neutral-50">
                    Pricing
                </h1>
                <p className="mt-4 max-w-2xl text-base text-neutral-500 dark:text-neutral-400">
                    Start free. Upgrade when you&rsquo;re ready for more. All
                    plans include monthly credits and Film-maker&rsquo;s full
                    creative toolset &mdash; no daily limits on paid tiers.
                </p>
            </header>

            <section className="mx-auto max-w-6xl px-6 pb-16 sm:pb-24">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {SUBSCRIPTION_PLANS.map((plan) => (
                        <PlanCard
                            key={plan.id}
                            plan={plan}
                            currentPlan={currentPlan}
                            isAuthenticated={!!session?.user}
                        />
                    ))}
                </div>

                <p className="mt-10 text-center text-xs text-neutral-500 dark:text-neutral-400">
                    Prices in USD. Taxes calculated at checkout where
                    applicable. Cancel anytime.
                </p>
            </section>
        </main>
    );
}

// ─── Plan card ──────────────────────────────────────────────────────────────

interface PlanCardProps {
    plan: SubscriptionPlan;
    currentPlan: string | null;
    isAuthenticated: boolean;
}

function PlanCard({ plan, currentPlan, isAuthenticated }: PlanCardProps) {
    const isFeatured = "featured" in plan && plan.featured === true;
    const isCurrent = currentPlan === plan.id;

    return (
        <div
            className={cn(
                "relative flex flex-col rounded-2xl border p-6 transition-colors",
                "bg-white dark:bg-neutral-950",
                isFeatured
                    ? "border-neutral-900 ring-1 ring-neutral-900/10 dark:border-neutral-50 dark:ring-neutral-50/10"
                    : "border-neutral-200 dark:border-neutral-800",
            )}
        >
            {isFeatured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-neutral-950 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white dark:bg-white dark:text-neutral-950">
                    Most popular
                </div>
            )}

            <div className="flex-1">
                <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
                    {plan.name}
                </h2>
                <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                        {plan.priceLabel}
                    </span>
                    {plan.interval && (
                        <span className="text-sm text-neutral-500 dark:text-neutral-400">
                            /{plan.interval}
                        </span>
                    )}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                    {plan.description}
                </p>

                <ul className="mt-6 space-y-2.5 text-sm">
                    {plan.features.map((feature) => (
                        <li
                            key={feature}
                            className="flex items-start gap-2 text-neutral-700 dark:text-neutral-300"
                        >
                            <CheckIcon />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="mt-8">
                {plan.isFree ? (
                    <FreePlanCta
                        isCurrent={isCurrent}
                        isAuthenticated={isAuthenticated}
                    />
                ) : (
                    <UpgradeButton
                        planId={plan.id}
                        planName={plan.name}
                        isCurrent={isCurrent}
                        isAuthenticated={isAuthenticated}
                        isFeatured={isFeatured}
                    />
                )}
            </div>
        </div>
    );
}

function FreePlanCta({
    isCurrent,
    isAuthenticated,
}: {
    isCurrent: boolean;
    isAuthenticated: boolean;
}) {
    if (isCurrent) {
        return (
            <div className="h-11 rounded-xl bg-neutral-100 flex items-center justify-center text-sm font-medium text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                Current plan
            </div>
        );
    }
    return (
        <Link
            href={isAuthenticated ? "/dashboard" : "/login"}
            className="flex h-11 items-center justify-center rounded-xl border border-neutral-200 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-900"
        >
            Get started
        </Link>
    );
}

function CheckIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="mt-0.5 shrink-0 text-neutral-400"
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}
