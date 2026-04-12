/**
 * Auteur loading skeleton — shown while the server verifies project
 * ownership and loads plan/balance data for the generation form.
 */

export default function AuteurLoading() {
    return (
        <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
            {/* Nav skeleton */}
            <nav className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/80">
                <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
                    <div className="h-4 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                    <div className="flex-1" />
                    <div className="h-9 w-20 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-900" />
                    <div className="h-9 w-16 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-900" />
                    <div className="h-9 w-9 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
                </div>
            </nav>

            <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                    {/* Form panel skeleton */}
                    <div className="space-y-5">
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                                <div className="h-6 w-16 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
                            </div>
                            <div className="mt-2 h-4 w-40 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
                        </div>

                        {/* Prompt area skeleton */}
                        <div>
                            <div className="mb-1.5 h-4 w-12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                            <div className="h-24 w-full animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />
                        </div>

                        {/* Options row skeleton */}
                        <div className="grid grid-cols-3 gap-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i}>
                                    <div className="mb-1.5 h-3 w-14 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
                                    <div className="h-10 w-full animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-900" />
                                </div>
                            ))}
                        </div>

                        {/* Button skeleton */}
                        <div className="h-12 w-full animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />

                        {/* Credits text skeleton */}
                        <div className="h-3 w-44 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
                    </div>

                    {/* Canvas panel skeleton */}
                    <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 lg:min-h-[500px]">
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-10 w-10 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-900" />
                            <div className="h-4 w-40 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
