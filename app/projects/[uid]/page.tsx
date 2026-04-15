/**
 * /projects/[uid] — project detail page.
 *
 * Shows the project's generations in a gallery grid with a header
 * containing the project name, generation count, and a CTA to
 * generate new images within this project.
 *
 * Server component — fetches project + generations server-side.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOnboardedUser } from "@/lib/auth-server";
import { getProject } from "@/lib/projects";
import { listGenerationsByProject } from "@/lib/generations";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { ProjectSettings } from "./project-settings";

interface PageProps {
    params: Promise<{ uid: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { uid } = await params;
    const { user } = await requireOnboardedUser();
    const project = await getProject(uid, user.id);
    return {
        title: project?.name ?? "Project",
    };
}

export default async function ProjectDetailPage({ params }: PageProps) {
    const { uid } = await params;
    const { user } = await requireOnboardedUser();

    const project = await getProject(uid, user.id);
    if (!project) notFound();

    const generations = await listGenerationsByProject(
        project.id,
        user.id,
        50,
    );

    return (
        <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
            <AppNav />

            <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <Link
                                href="/studio"
                                className="mt-1 text-sm text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                                aria-label="Back to dashboard"
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden
                                >
                                    <polyline points="15 18 9 12 15 6" />
                                </svg>
                            </Link>
                            <ProjectSettings
                                uid={project.uid}
                                name={project.name}
                                description={project.description}
                            />
                        </div>
                        <p className="mt-1 pl-6 text-sm text-neutral-400 dark:text-neutral-500">
                            {generations.length} generation{generations.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                    <Link href={`/auteur?project=${project.uid}`}>
                        <Button variant="primary" size="lg">
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="mr-1.5"
                                aria-hidden
                            >
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Generate
                        </Button>
                    </Link>
                </div>

                {/* Generations gallery */}
                {generations.length === 0 ? (
                    <div className="mt-16 flex flex-col items-center text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-900">
                            <svg
                                width="28"
                                height="28"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-neutral-400"
                                aria-hidden
                            >
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                            </svg>
                        </div>
                        <h2 className="mt-4 text-lg font-semibold text-neutral-950 dark:text-neutral-50">
                            No generations yet
                        </h2>
                        <p className="mt-2 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
                            Start creating images for this project. Each generation
                            will be organized here.
                        </p>
                        <Link href={`/auteur?project=${project.uid}`} className="mt-6">
                            <Button variant="primary" size="lg">
                                Create your first image
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {generations.map((gen) => (
                            <GenerationCard
                                key={gen.uid}
                                prompt={gen.prompt}
                                status={gen.status}
                                resolution={gen.resolution}
                                aspectRatio={gen.aspectRatio}
                                imageUrl={gen.thumbnailUrls?.[0] ?? null}
                                creditCost={gen.creditCost}
                                createdAt={gen.createdAt}
                                errorMessage={gen.errorMessage}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

// ─── Generation card ────────────────────────────────────────────────────────

interface GenerationCardProps {
    prompt: string;
    status: "pending" | "done" | "failed";
    resolution: string;
    aspectRatio: string | null;
    imageUrl: string | null;
    creditCost: number;
    createdAt: number;
    errorMessage: string | null;
}

function GenerationCard({
    prompt,
    status,
    resolution,
    aspectRatio,
    imageUrl,
    creditCost,
    createdAt,
    errorMessage,
}: GenerationCardProps) {
    const timeAgo = formatTimeAgo(createdAt);

    return (
        <div className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950 dark:hover:shadow-neutral-900/30">
            <div className="relative aspect-square bg-neutral-100 dark:bg-neutral-900">
                {status === "done" && imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={imageUrl}
                        alt={prompt}
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                ) : status === "pending" ? (
                    <div className="flex h-full items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700 dark:border-neutral-700 dark:border-t-neutral-300" />
                    </div>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                        <svg
                            width="20"
                            height="20"
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
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            {errorMessage ?? "Generation failed"}
                        </span>
                    </div>
                )}

                <div className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
                    {resolution}{aspectRatio && aspectRatio !== "1:1" ? ` · ${aspectRatio}` : ""}
                </div>
            </div>

            <div className="p-3">
                <p className="line-clamp-2 text-sm text-neutral-700 dark:text-neutral-300">
                    {prompt}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500">
                    <span>{timeAgo}</span>
                    <span>{creditCost} cr</span>
                </div>
            </div>
        </div>
    );
}

function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}
