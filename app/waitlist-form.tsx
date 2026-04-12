"use client";

/**
 * WaitlistForm — single button, no email input.
 *
 * The user is already authenticated. The API reads their email from the
 * session on the backend. One click to join.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Status =
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "success" }
    | { kind: "error"; message: string };

export function WaitlistForm() {
    const [status, setStatus] = useState<Status>({ kind: "idle" });

    async function handleJoin() {
        setStatus({ kind: "submitting" });

        try {
            const response = await fetch("/api/waitlist", {
                method: "POST",
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setStatus({
                    kind: "error",
                    message:
                        (data as { error?: string } | null)?.error ??
                        "Something went wrong. Please try again.",
                });
                return;
            }

            setStatus({ kind: "success" });
        } catch {
            setStatus({
                kind: "error",
                message: "Network error. Please try again.",
            });
        }
    }

    if (status.kind === "success") {
        return (
            <div className="text-center">
                <p className="text-lg font-medium text-white">
                    You&apos;re on the list.
                </p>
                <p className="mt-2 text-sm text-white/60">
                    We&apos;ll reach out when your spot opens up.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-3">
            <Button
                type="button"
                variant="primary"
                size="lg"
                disabled={status.kind === "submitting"}
                onClick={handleJoin}
                className="bg-white text-neutral-950 hover:bg-white/90"
            >
                {status.kind === "submitting" ? "Joining…" : "Join the waiting list"}
            </Button>

            {status.kind === "error" && (
                <p role="alert" className="text-sm text-[var(--destructive)]">
                    {status.message}
                </p>
            )}
        </div>
    );
}
