/**
 * Credits page — signed-in users only.
 *
 * Shows:
 *   • Current credit balance (two pools + total)
 *   • Plan name + "Manage billing" button if on a paid plan
 *   • "Upgrade" CTA if on the free plan
 *   • Activity feed of recent credit transactions
 *
 * Mobile-first: stacked layout, large touch targets, the manage-billing
 * button anchors below the balance so it's one thumb-reach on phones.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { requireSession } from "@/lib/auth-server";
import { getBalance, listRecentTransactions } from "@/lib/credits";
import { getPlan, isFreePlan, SOLO_DAILY_CREDIT_LIMIT } from "@/lib/constants";

import { ManageBillingButton } from "./manage-billing-button";

export const metadata: Metadata = {
    title: "Credits",
};

export default async function CreditsPage() {
    const { user } = await requireSession();

    const [balance, transactions] = await Promise.all([
        getBalance(user.id),
        listRecentTransactions(user.id, 20),
    ]);

    if (!balance) {
        // Should never happen — user_profile is provisioned at signup.
        throw new Error("Missing user_profile for authenticated user");
    }

    const plan = getPlan(balance.plan);
    const total = balance.subscriptionCredits + balance.purchasedCredits;
    const onFreePlan = isFreePlan(balance.plan);

    return (
        <main className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
            <header className="mx-auto max-w-3xl px-6 pt-8 pb-6 sm:pt-16">
                <Link
                    href="/dashboard"
                    className="text-sm font-semibold tracking-tight text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
                >
                    ← Dashboard
                </Link>
                <h1 className="mt-6 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl dark:text-neutral-50">
                    Credits
                </h1>
            </header>

            <section className="mx-auto max-w-3xl px-6 pb-16 sm:pb-24">
                {/* Balance card */}
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950 sm:p-8">
                    <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        Current balance
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <div className="text-5xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                            {total.toLocaleString()}
                        </div>
                        <div className="text-sm text-neutral-500 dark:text-neutral-400">
                            credits
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="text-neutral-500 dark:text-neutral-400">
                                Subscription
                            </div>
                            <div className="mt-1 font-medium text-neutral-900 dark:text-neutral-50">
                                {balance.subscriptionCredits.toLocaleString()}
                            </div>
                        </div>
                        <div>
                            <div className="text-neutral-500 dark:text-neutral-400">
                                Purchased
                            </div>
                            <div className="mt-1 font-medium text-neutral-900 dark:text-neutral-50">
                                {balance.purchasedCredits.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-neutral-200 pt-6 dark:border-neutral-800">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                                Plan
                            </div>
                            <div className="mt-1 text-base font-medium text-neutral-900 dark:text-neutral-50">
                                {plan?.name ?? balance.plan}
                            </div>
                        </div>
                        {onFreePlan ? (
                            <Link
                                href="/pricing"
                                className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-950 px-4 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                            >
                                Upgrade
                            </Link>
                        ) : (
                            <ManageBillingButton />
                        )}
                    </div>

                    {onFreePlan && (
                        <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
                            Free plan: {SOLO_DAILY_CREDIT_LIMIT} credits per day
                            cap. Upgrade for unlimited daily generations.
                        </p>
                    )}
                </div>

                {/* Activity feed */}
                <div className="mt-10">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        Recent activity
                    </h2>
                    {transactions.length === 0 ? (
                        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                            No transactions yet.
                        </p>
                    ) : (
                        <ul className="mt-4 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
                            {transactions.map((tx) => (
                                <li
                                    key={tx.id}
                                    className="flex items-center justify-between gap-4 px-5 py-4"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-50">
                                            {tx.description}
                                        </div>
                                        <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                                            {new Date(tx.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                    <div
                                        className={`shrink-0 text-sm font-medium tabular-nums ${
                                            tx.amount > 0
                                                ? "text-green-600 dark:text-green-400"
                                                : tx.amount < 0
                                                ? "text-neutral-700 dark:text-neutral-300"
                                                : "text-neutral-400"
                                        }`}
                                    >
                                        {tx.amount > 0 ? "+" : ""}
                                        {tx.amount}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>
        </main>
    );
}
