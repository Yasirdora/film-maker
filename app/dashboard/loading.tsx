/**
 * Dashboard loading skeleton — shown by Next.js while the server
 * component fetches balance and project data. Prevents a blank
 * white screen during navigation.
 */

export default function DashboardLoading() {
    return (
        <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
            {/* Nav skeleton */}
            <NavSkeleton />

            <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
                {/* Header skeleton */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="h-7 w-52 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
                        <div className="mt-2 h-4 w-36 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-900" />
                    </div>
                </div>

                {/* Section heading skeleton */}
                <div className="mt-8">
                    <div className="h-6 w-24 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
                    <div className="mt-2 h-4 w-56 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-900" />
                </div>

                {/* Project grid skeleton */}
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* New project placeholder */}
                    <div className="min-h-[200px] rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-800" />

                    {/* Project card skeletons */}
                    {Array.from({ length: 3 }).map((_, i) => (
                        <ProjectCardSkeleton key={i} />
                    ))}
                </div>
            </main>
        </div>
    );
}

function NavSkeleton() {
    return (
        <nav className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/80">
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
                <div className="h-4 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                <div className="flex-1" />
                <div className="h-9 w-20 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-900" />
                <div className="h-9 w-16 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-900" />
                <div className="h-9 w-9 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
            </div>
        </nav>
    );
}

function ProjectCardSkeleton() {
    return (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="aspect-[16/10] animate-pulse bg-neutral-100 dark:bg-neutral-900" />
            <div className="p-4">
                <div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                <div className="mt-2 flex justify-between">
                    <div className="h-3 w-16 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
                    <div className="h-3 w-12 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
                </div>
            </div>
        </div>
    );
}
