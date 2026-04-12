/**
 * /payments/success
 *
 * Post-checkout landing page. Stripe redirects here after a successful
 * Checkout Session with `?session_id={CHECKOUT_SESSION_ID}`.
 *
 * We intentionally do NOT verify the session or apply the grant here —
 * the webhook handler is the single source of truth for billing state.
 * This page just confirms the user has landed safely and routes them on.
 *
 * Race note: the webhook may lag the redirect by a second or two. Rather
 * than polling for state here (complex), we show a friendly "processing"
 * message. By the time the user clicks through to /dashboard the grant
 * will almost always be applied.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth-server";

export const metadata: Metadata = {
    title: "Thank you",
};

export default async function PaymentsSuccessPage() {
    await requireOnboardedUser();

    return (
        <main className="min-h-dvh flex items-center justify-center px-6 bg-neutral-50 dark:bg-neutral-950">
            <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-950">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400">
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                    >
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                    Thank you
                </h1>
                <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                    Your subscription is activating. Credits usually appear
                    within a few seconds.
                </p>
                <Link
                    href="/dashboard"
                    className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-neutral-950 px-6 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                    Go to dashboard
                </Link>
            </div>
        </main>
    );
}
