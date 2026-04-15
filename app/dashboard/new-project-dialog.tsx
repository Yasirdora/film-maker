"use client";

/**
 * NewProjectButton — one-click project creation.
 *
 * Clicking creates a project with an auto-generated name based on the
 * current date and time (e.g. "Project — Apr 12, 4:35 PM"). The name
 * can be changed later from the project detail page.
 *
 * Zero friction — no form, no modal. Click → create → navigate.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

function generateProjectName(): string {
    const now = new Date();
    const date = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
    const time = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
    return `Project — ${date}, ${time}`;
}

export function NewProjectButton() {
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    async function handleCreate() {
        if (isCreating) return;

        setError("");
        setIsCreating(true);

        try {
            const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: generateProjectName() }),
            });

            const data = (await res.json()) as { uid?: string; error?: string };

            if (!res.ok) {
                setError(data.error ?? "Failed to create project");
                setIsCreating(false);
                return;
            }

            router.push(`/projects/${data.uid}`);
        } catch {
            setError("Something went wrong. Please try again.");
            setIsCreating(false);
        }
    }

    return (
        <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating}
            className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-200 bg-white/50 transition-colors hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950/50 dark:hover:border-neutral-600 dark:hover:bg-neutral-900/50"
        >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
                {isCreating ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-600 dark:border-t-neutral-300" />
                ) : (
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-neutral-400 dark:text-neutral-500"
                        aria-hidden
                    >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                )}
            </div>
            <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {isCreating ? "Creating…" : "New project"}
            </span>
            {error && (
                <span className="text-xs text-[var(--destructive)]">
                    {error}
                </span>
            )}
        </button>
    );
}
