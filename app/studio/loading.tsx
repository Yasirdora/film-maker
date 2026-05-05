/**
 * Studio loading skeleton.
 *
 * Matches the dark studio layout: header with brand + credits badge,
 * welcome text, and a 3-column project card grid.
 */

export default function StudioLoading() {
    return (
        <div className="min-h-dvh bg-ws-canvas">
            {/* Header */}
            <div className="mx-auto flex max-w-[85rem] items-center gap-3 px-4 py-4 sm:px-6 sm:py-5">
                <div className="h-4 w-20 animate-pulse rounded bg-white/10" />
                <div className="flex-1" />
                <div className="h-[34px] w-16 animate-pulse rounded-lg bg-white/[0.06]" />
                <div className="h-9 w-9 animate-pulse rounded-full bg-white/[0.06]" />
            </div>

            <div className="mx-auto max-w-[85rem] px-4 pb-16 sm:px-6">
                {/* Welcome */}
                <div className="mt-4 sm:mt-6">
                    <div className="h-8 w-56 animate-pulse rounded-lg bg-white/10" />
                    <div className="mt-2 h-4 w-40 animate-pulse rounded-md bg-white/[0.06]" />
                </div>

                {/* Projects */}
                <div className="mt-10">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="h-6 w-20 animate-pulse rounded-md bg-white/10" />
                            <div className="mt-2 h-4 w-56 animate-pulse rounded-md bg-white/[0.06]" />
                        </div>
                        <div className="h-12 w-40 animate-pulse rounded-xl bg-white/[0.06]" />
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 min-[1400px]:grid-cols-4 sm:gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div
                                key={i}
                                className="overflow-hidden rounded-2xl bg-white/[0.04]"
                            >
                                <div className="aspect-[2/1] animate-pulse rounded-b-xl bg-white/[0.03]" />
                                <div className="p-3">
                                    <div className="h-4 w-28 animate-pulse rounded bg-white/[0.06]" />
                                    <div className="mt-2.5 flex items-center justify-between">
                                        <div className="h-3 w-16 animate-pulse rounded bg-white/[0.04]" />
                                        <div className="h-3 w-12 animate-pulse rounded bg-white/[0.04]" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
