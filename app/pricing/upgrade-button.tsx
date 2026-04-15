"use client";

/**
 * Upgrade button for a paid plan.
 *
 * Behavior:
 *   • Unauthenticated user → redirects to /login?from=/pricing
 *   • Authenticated, not current plan → POSTs to /api/stripe/checkout
 *     and redirects the browser to Stripe's hosted checkout
 *   • Authenticated, current plan → disabled "Current plan" state
 *   • On 401 from the API → redirects to /login (session may have
 *     expired client-side without the middleware catching it)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface UpgradeButtonProps {
    planId: string;
    planName: string;
    isCurrent: boolean;
    isAuthenticated: boolean;
    isFeatured: boolean;
}

export function UpgradeButton({
    planId,
    planName,
    isCurrent,
    isAuthenticated,
    isFeatured,
}: UpgradeButtonProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (isCurrent) {
        return (
            <div className="h-11 rounded-xl bg-neutral-100 flex items-center justify-center text-sm font-medium text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                Current plan
            </div>
        );
    }

    async function handleClick() {
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

    return (
        <div className="space-y-2">
            <Button
                variant={isFeatured ? "primary" : "outline"}
                size="md"
                fullWidth
                disabled={loading}
                onClick={handleClick}
                aria-label={`Upgrade to ${planName}`}
            >
                {loading ? "Redirecting…" : `Upgrade to ${planName}`}
            </Button>
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
