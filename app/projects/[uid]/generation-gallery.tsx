"use client";

/**
 * GenerationGallery — scrollable grid of generated images.
 *
 * Renders inside the workspace's scrollable area. Newest first.
 * Pending generations show a spinner, failed ones show the error.
 * Empty state encourages the user to start generating.
 */

import type { GenerationItem } from "./project-workspace";

interface GenerationGalleryProps {
    generations: GenerationItem[];
}

export function GenerationGallery({ generations }: GenerationGalleryProps) {
    if (generations.length === 0) {
        return (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04]">
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[#52525b]"
                        aria-hidden
                    >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                </div>
                <h2 className="mt-4 text-lg font-semibold">
                    No generations yet
                </h2>
                <p className="mt-2 max-w-sm text-sm text-[#9ca3af]">
                    Type a prompt below and hit generate to create your first image.
                </p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6 pb-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 sm:gap-3">
                {generations.map((gen) => (
                    <GalleryCard key={gen.uid} generation={gen} />
                ))}
            </div>
        </div>
    );
}

// ─── Gallery card ───────────────────────────────────────────────────────────

function GalleryCard({ generation }: { generation: GenerationItem }) {
    const { status, kind, imageUrl, prompt, resolution, aspectRatio, errorMessage } =
        generation;
    const isVideo = kind === "video";

    return (
        <div className="group relative overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] transition-all hover:ring-white/[0.12]">
            <div className="relative aspect-square">
                {status === "done" && imageUrl && isVideo ? (
                    <video
                        src={imageUrl}
                        className="h-full w-full object-cover"
                        controls
                        playsInline
                        muted
                        loop
                        preload="metadata"
                    />
                ) : status === "done" && imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={imageUrl}
                        alt={prompt.slice(0, 100)}
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                ) : status === "pending" ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
                        {isVideo && (
                            <span className="text-[11px] text-[#52525b]">Generating video...</span>
                        )}
                    </div>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-[var(--destructive)]"
                            aria-hidden
                        >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span className="text-[11px] text-[#9ca3af]">
                            {errorMessage ?? "Failed"}
                        </span>
                    </div>
                )}

                {/* Type + resolution badge */}
                {status === "done" && (
                    <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
                        {isVideo && (
                            <div className="flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                                <svg className="text-white/80" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                                <span className="text-[10px] font-medium text-white/80">Video</span>
                            </div>
                        )}
                        <div className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
                            {resolution}
                            {aspectRatio && aspectRatio !== "1:1"
                                ? ` · ${aspectRatio}`
                                : ""}
                        </div>
                    </div>
                )}
            </div>

            {/* Prompt preview — visible on hover (desktop) */}
            <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/80 via-black/60 to-transparent p-3 pt-8 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                <p className="line-clamp-2 text-[12px] leading-relaxed text-white/80">
                    {prompt}
                </p>
            </div>
        </div>
    );
}
