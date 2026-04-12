/**
 * Dashboard loading skeleton.
 *
 * Next.js renders this automatically via Suspense while the dashboard
 * server component awaits its data (auth, balance, projects). The
 * skeleton mirrors the exact layout structure of the real page so
 * there is zero layout shift when the data resolves.
 *
 * The nav is replicated here as a static skeleton because the real
 * AppNav is a server component that also fetches data (balance for
 * the credits badge) and would block rendering if shared.
 */

export default function DashboardLoading() {
    return (
        <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
            {/* Nav skeleton — mirrors AppNav's 56px fixed height */}
            <nav className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/80">
                <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
                    <div className="h-4 w-[72px] animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                    <div className="flex-1" />
                    <div className="h-9 w-[88px] animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-900" />
                    <div className="h-9 w-[60px] animate-pulse rounded-lg border border-neutral-200 dark:border-neutral-800" />
                    <div className="h-9 w-9 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
                </div>
            </nav>

            <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
                {/* Header skeleton — matches "Welcome back, Name" + credits line */}
                <div>
                    <div className="h-7 w-56 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
                    <div className="mt-2 h-4 w-40 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-900" />
                </div>

                {/* Section heading skeleton — matches "Projects" + subtitle */}
                <section className="mt-8">
                    <div className="h-6 w-20 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
                    <div className="mt-2 h-4 w-60 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-900" />

                    {/* Project grid skeleton — 1 dashed + 3 card placeholders */}
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {/* New project card placeholder */}
                        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-800">
                            <div className="h-12 w-12 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
                            <div className="h-4 w-20 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
                        </div>

                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
                            >
                                <div className="aspect-[16/10] animate-pulse bg-neutral-100 dark:bg-neutral-900" />
                                <div className="p-4">
                                    <div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                                    <div className="mt-2 flex items-center justify-between">
                                        <div className="h-3 w-16 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
                                        <div className="h-3 w-14 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
