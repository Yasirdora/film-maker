/**
 * Project not-found page — shown when the project UID doesn't exist
 * or belongs to another user.
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ProjectNotFound() {
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-900">
                <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-neutral-400"
                    aria-hidden
                >
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
            </div>
            <h1 className="mt-4 text-lg font-semibold text-neutral-950 dark:text-neutral-50">
                Project not found
            </h1>
            <p className="mt-2 max-w-sm text-center text-sm text-neutral-500 dark:text-neutral-400">
                This project doesn&apos;t exist or you don&apos;t have access to it.
            </p>
            <Link href="/dashboard" className="mt-6">
                <Button variant="primary" size="md">
                    Back to dashboard
                </Button>
            </Link>
        </div>
    );
}
