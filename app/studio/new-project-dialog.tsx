"use client";

/**
 * NewProjectButton — one-click project creation.
 *
 * Two render variants, both driven by the same element + state:
 *   • "header" — inline on desktop; on mobile the outer wrapper detaches
 *                into a centered FAB above the tab bar. Single button,
 *                single state, single network request in flight.
 *   • "empty"  — centered CTA used only in the zero-projects empty state.
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

interface NewProjectButtonProps {
    variant?: "header" | "empty";
}

export function NewProjectButton({ variant = "header" }: NewProjectButtonProps) {
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

    function renderCreateButton(extraClassName = "") {
        return (
            <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating}
                aria-label="Create project"
                className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-black transition-colors hover:bg-neutral-200 active:scale-95 disabled:opacity-50 ${extraClassName}`}
            >
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {isCreating ? "Creating…" : "Create project"}
            </button>
        );
    }

    if (variant === "empty") {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/[0.08] px-6 py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06]">
                    <svg
                        width="26"
                        height="26"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[#9ca3af]"
                        aria-hidden
                    >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </div>
                <h3 className="mt-5 text-base font-semibold">
                    No projects yet
                </h3>
                <p className="mt-1.5 max-w-sm text-sm text-[#9ca3af]">
                    Create a project to organize your generations.
                </p>
                <div className="mt-6">
                    {renderCreateButton()}
                </div>
                {error && (
                    <span className="mt-3 text-xs text-[var(--destructive)]">
                        {error}
                    </span>
                )}
            </div>
        );
    }

    // "header" variant. The wrapper starts as a fixed, centered FAB on
    // mobile; at sm+ it collapses back into normal flow so the parent
    // flex row can position it next to the heading. Only one element
    // hits the DOM — the same button, reparented by CSS.
    return (
        <div className="fixed bottom-[82px] left-1/2 z-40 flex -translate-x-1/2 flex-col items-center sm:static sm:z-auto sm:translate-x-0 sm:items-end">
            {renderCreateButton(
                "shadow-[0_10px_30px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.3)] sm:shadow-none",
            )}
            {error && (
                <span className="mt-2 rounded-lg bg-[var(--destructive)] px-3 py-2 text-xs font-medium text-white shadow-lg sm:mt-1.5 sm:rounded-none sm:bg-transparent sm:p-0 sm:text-[var(--destructive)] sm:shadow-none">
                    {error}
                </span>
            )}
        </div>
    );
}
