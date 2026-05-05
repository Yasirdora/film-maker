/**
 * Project workspace loading skeleton.
 *
 * Matches the workspace layout: dark background, minimal header,
 * gallery grid placeholders, and composer bar at the bottom.
 */

export default function ProjectLoading() {
    return (
        <div className="flex h-dvh flex-col bg-ws-canvas">
            {/* Header */}
            <div className="flex shrink-0 items-center px-5 h-[48px] sm:px-8 sm:h-[56px]">
                <div className="h-4 w-4 animate-pulse rounded bg-white/10" />
                <div className="ml-3 h-5 w-32 animate-pulse rounded-md bg-white/10" />
                <div className="flex-1" />
                <div className="h-[34px] w-16 animate-pulse rounded-lg bg-white/[0.06]" />
            </div>

            {/* Gallery placeholders */}
            <div className="flex-1 overflow-hidden px-3 py-4 sm:px-6 sm:py-6">
                <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 sm:gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div
                            key={i}
                            className="aspect-square animate-pulse rounded-xl bg-white/[0.04]"
                        />
                    ))}
                </div>
            </div>

            {/* Composer placeholder */}
            <div className="shrink-0 px-3 pb-3 sm:pb-8 sm:px-0">
                <div className="mx-auto w-full sm:max-w-[600px]">
                    <div className="h-[100px] animate-pulse rounded-2xl bg-white/[0.04]" />
                </div>
            </div>
        </div>
    );
}
