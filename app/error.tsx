"use client";

/**
 * Root error boundary — catches unhandled exceptions in any route
 * segment and renders a branded error page instead of Next.js's
 * generic white "Application error" screen.
 */

import { Button } from "@/components/ui/button";

export default function RootError({
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <main className="min-h-dvh flex items-center justify-center px-6 bg-neutral-50 dark:bg-neutral-950">
            <div className="w-full max-w-md text-center">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>
                <h1 className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">
                    Something went wrong
                </h1>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                    An unexpected error occurred. Please try again.
                </p>
                <div className="mt-6 flex items-center justify-center gap-3">
                    <Button variant="primary" size="md" onClick={reset}>
                        Try again
                    </Button>
                    <Button
                        variant="outline"
                        size="md"
                        onClick={() => (window.location.href = "/")}
                    >
                        Go home
                    </Button>
                </div>
            </div>
        </main>
    );
}
