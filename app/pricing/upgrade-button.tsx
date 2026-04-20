"use client";

/**
 * Upgrade button for a paid plan.
 *
 * Behavior:
 *   • Unauthenticated user → redirects to /login?from=/pricing
 *   • Authenticated, not current plan → POSTs to /api/stripe/checkout
 *     and redirects the browser to Stripe's hosted checkout
 *   • Authenticated, current plan → shows a "Manage plan" button that
 *     POSTs to /api/stripe/portal and opens the Stripe customer portal
 *   • On 401 from either API → redirects to /login
 *
 * Styles are written directly (not via the shared Button component's
 * `outline` variant) because the pricing page is always dark and we
 * want a quieter, dark-friendly border style rather than the shared
 * light-mode white-fill default.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface UpgradeButtonProps {
    planId: string;
    planName: string;
    isCurrent: boolean;
    isAuthenticated: boolean;
    isFeatured: boolean;
    /** When false, paid upgrades are disabled site-wide (testing phase). */
    paidPlansEnabled: boolean;
}

const BASE_CLASSES =
    "inline-flex h-12 w-full items-center justify-center rounded-xl px-6 text-base font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";

export function UpgradeButton({
    planId,
    planName,
    isCurrent,
    isAuthenticated,
    isFeatured,
    paidPlansEnabled,
}: UpgradeButtonProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Testing-phase short-circuit: paid plans are visible for roadmap
    // discoverability, but not purchasable yet.
    if (!paidPlansEnabled && !isCurrent) {
        return (
            <div className="space-y-2">
                <button
                    type="button"
                    disabled
                    aria-label={`${planName} coming soon`}
                    className={cn(
                        BASE_CLASSES,
                        "bg-white/[0.04] text-neutral-400 ring-1 ring-inset ring-white/10",
                    )}
                >
                    Coming soon
                </button>
                <p className="text-center text-xs text-neutral-500">
                    Paid plans unlock after the testing phase.
                </p>
            </div>
        );
    }

    async function handleCheckout() {
        if (!isAuthenticated) {
            router.push("/login?from=/pricing");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planId }),
            });

            if (res.status === 401) {
                router.push("/login?from=/pricing");
                return;
            }

            const data = (await res.json().catch(() => ({}))) as {
                url?: string;
                error?: string;
            };

            if (!res.ok || !data.url) {
                throw new Error(
                    data.error ?? "Couldn't start checkout. Try again.",
                );
            }

            window.location.href = data.url;
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Couldn't start checkout. Try again.",
            );
            setLoading(false);
        }
    }

    async function handleManage() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/stripe/portal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            if (res.status === 401) {
                router.push("/login?from=/pricing");
                return;
            }

            const data = (await res.json().catch(() => ({}))) as {
                url?: string;
                error?: string;
            };

            if (!res.ok || !data.url) {
                throw new Error(
                    data.error ?? "Couldn't open billing portal. Try again.",
                );
            }

            window.location.href = data.url;
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Couldn't open billing portal. Try again.",
            );
            setLoading(false);
        }
    }

    const label = isCurrent
        ? loading
            ? "Opening…"
            : "Manage plan"
        : loading
            ? "Redirecting…"
            : `Get ${planName}`;

    const onClick = isCurrent ? handleManage : handleCheckout;

    const styleClasses = isFeatured
        ? "bg-white text-black hover:bg-neutral-200"
        : "bg-white/[0.06] text-neutral-100 hover:bg-white/[0.12]";

    return (
        <div className="space-y-2">
            <button
                type="button"
                disabled={loading}
                onClick={onClick}
                aria-label={label}
                className={cn(BASE_CLASSES, styleClasses)}
            >
                {label}
            </button>
            {error && (
                <p
                    role="alert"
                    className="text-center text-xs text-[var(--destructive)]"
                >
                    {error}
                </p>
            )}
        </div>
    );
}
