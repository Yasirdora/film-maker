"use client";

/**
 * ArchivedProjects — collapsible section showing archived projects.
 *
 * Hidden by default. Clicking the toggle reveals the archived project
 * cards with a "Restore" action on each. Restoring refreshes the page
 * so the project moves back to the active grid above.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ArchivedProject {
    uid: string;
    name: string;
    coverImageUrl: string | null;
    generationCount: number;
    updatedAt: number;
}

interface ArchivedProjectsProps {
    projects: ArchivedProject[];
}

export function ArchivedProjects({ projects }: ArchivedProjectsProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (projects.length === 0) return null;

    return (
        <section className="mt-12">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-sm text-[#52525b] transition-colors hover:text-[#9ca3af]"
            >
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
                    aria-hidden
                >
                    <polyline points="9 18 15 12 9 6" />
                </svg>
                Archived ({projects.length})
            </button>

            {isOpen && (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {projects.map((project) => (
                        <ArchivedProjectCard
                            key={project.uid}
                            uid={project.uid}
                            name={project.name}
                            coverImageUrl={project.coverImageUrl}
                            generationCount={project.generationCount}
                            updatedAt={project.updatedAt}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

// ─── Archived project card ──────────────────────────────────────────────────

function ArchivedProjectCard({
    uid,
    name,
    coverImageUrl,
    generationCount,
    updatedAt,
}: ArchivedProject) {
    const [isRestoring, setIsRestoring] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    async function handleRestore() {
        setIsRestoring(true);
        setError("");

        try {
            const res = await fetch(`/api/projects/${uid}/restore`, {
                method: "POST",
            });

            if (!res.ok) {
                const data = (await res.json()) as { error?: string };
                setError(data.error ?? "Failed to restore");
                setIsRestoring(false);
                return;
            }

            router.refresh();
        } catch {
            setError("Something went wrong.");
            setIsRestoring(false);
        }
    }

    return (
        <div className="overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.06] opacity-60 transition-opacity hover:opacity-100">
            {/* Cover image */}
            <div className="relative aspect-[16/10] bg-white/[0.02]">
                {coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={coverImageUrl}
                        alt={name}
                        className="h-full w-full object-cover grayscale"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <svg
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-[#2a2a2d]"
                            aria-hidden
                        >
                            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Info + restore */}
            <div className="p-4">
                <h3 className="truncate text-sm font-semibold">
                    {name}
                </h3>
                <div className="mt-1.5 flex items-center justify-between text-xs text-[#52525b]">
                    <span>
                        {generationCount} image{generationCount !== 1 ? "s" : ""}
                    </span>
                    <button
                        type="button"
                        onClick={handleRestore}
                        disabled={isRestoring}
                        className="font-medium text-[#9ca3af] underline underline-offset-2 transition-colors hover:text-white disabled:opacity-50"
                    >
                        {isRestoring ? "Restoring…" : "Restore"}
                    </button>
                </div>
                {error && (
                    <p className="mt-1 text-xs text-[var(--destructive)]">{error}</p>
                )}
            </div>
        </div>
    );
}
