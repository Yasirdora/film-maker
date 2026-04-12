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
                className="flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
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
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white opacity-70 transition-opacity hover:opacity-100 dark:border-neutral-800 dark:bg-neutral-950">
            {/* Cover image */}
            <div className="relative aspect-[16/10] bg-neutral-100 dark:bg-neutral-900">
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
                            className="text-neutral-300 dark:text-neutral-700"
                            aria-hidden
                        >
                            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Info + restore */}
            <div className="p-4">
                <h3 className="truncate text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                    {name}
                </h3>
                <div className="mt-1.5 flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500">
                    <span>
                        {generationCount} image{generationCount !== 1 ? "s" : ""}
                    </span>
                    <button
                        type="button"
                        onClick={handleRestore}
                        disabled={isRestoring}
                        className="font-medium text-neutral-500 underline underline-offset-2 transition-colors hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-50"
                    >
                        {isRestoring ? "Restoring…" : "Restore"}
                    </button>
                </div>
                {error && (
                    <p className="mt-1 text-xs text-red-500">{error}</p>
                )}
            </div>
        </div>
    );
}
