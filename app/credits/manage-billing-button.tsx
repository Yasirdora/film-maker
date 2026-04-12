"use client";

/**
 * Manage billing button — client component.
 *
 * Hits /api/stripe/portal to mint a Customer Portal session for the
 * signed-in user, then redirects the browser to Stripe's hosted portal.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ManageBillingButton() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handle() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/stripe/portal", { method: "POST" });
            const data = (await res.json().catch(() => ({}))) as {
                url?: string;
                error?: string;
            };
            if (!res.ok || !data.url) {
                throw new Error(data.error ?? "Couldn't open billing portal.");
            }
            window.location.href = data.url;
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Couldn't open billing portal.",
            );
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={handle}
            >
                {loading ? "Opening…" : "Manage billing"}
            </Button>
            {error && (
                <p
                    role="alert"
                    className="text-[11px] text-red-600 dark:text-red-400"
                >
                    {error}
                </p>
            )}
        </div>
    );
}
