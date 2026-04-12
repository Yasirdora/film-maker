/**
 * Auth-flow layout.
 *
 * Centered, minimal, mobile-first. Uses dvh (dynamic viewport height) so
 * the layout is stable even when mobile Safari's address bar hides/shows.
 * Safe-area insets are respected so content never lives under the notch
 * or home indicator.
 */

import Link from "next/link";

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div
            className="min-h-dvh bg-neutral-50 dark:bg-neutral-950"
            style={{
                paddingTop: "env(safe-area-inset-top)",
                paddingBottom: "env(safe-area-inset-bottom)",
            }}
        >
            <header className="px-6 py-6">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-50"
                >
                    Film-maker
                </Link>
            </header>

            <main className="mx-auto flex w-full max-w-md flex-col px-6 pb-16 pt-8 sm:pt-16">
                {children}
            </main>
        </div>
    );
}
