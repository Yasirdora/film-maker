/**
 * Project detail loading skeleton — shown while the server fetches
 * project metadata and generation gallery.
 */

export default function ProjectLoading() {
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

            <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
                {/* Header skeleton */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                            <div className="h-7 w-48 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
                        </div>
                        <div className="mt-2 pl-6">
                            <div className="h-4 w-28 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
                        </div>
                    </div>
                    <div className="h-11 w-28 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
                </div>

                {/* Gallery skeleton */}
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
                        >
                            <div className="aspect-square animate-pulse bg-neutral-100 dark:bg-neutral-900" />
                            <div className="p-3">
                                <div className="h-4 w-full animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
                                <div className="mt-1 h-4 w-2/3 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
                                <div className="mt-2 flex justify-between">
                                    <div className="h-3 w-14 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
                                    <div className="h-3 w-10 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
