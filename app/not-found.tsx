/**
 * Root 404 page.
 *
 * Catches all unmatched routes and notFound() calls (e.g. from
 * projects/[uid] when the project doesn't exist). Branded to match
 * the existing error.tsx aesthetic.
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    return (
        <main className="min-h-dvh flex items-center justify-center px-6 bg-neutral-50 dark:bg-neutral-950">
            <div className="w-full max-w-md text-center">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
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
                        <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
                        <line x1="9" y1="9" x2="9.01" y2="9" />
                        <line x1="15" y1="9" x2="15.01" y2="9" />
                    </svg>
                </div>
                <h1 className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">
                    Page not found
                </h1>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                    The page you&apos;re looking for doesn&apos;t exist or has been
                    moved.
                </p>
                <div className="mt-6">
                    <Link href="/studio">
                        <Button variant="primary" size="md">
                            Go to studio
                        </Button>
                    </Link>
                </div>
            </div>
        </main>
    );
}
