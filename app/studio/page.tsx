/**
 * Studio — the home for signed-in users.
 *
 * Shows: credit balance summary, project grid with cover images,
 * and a "New project" CTA. Projects are the primary organizational
 * unit — all generations live within a project.
 *
 * Server component — fetches balance + projects server-side.
 * Client interactivity delegated to child components.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { requireOnboardedUser } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { listProjects, listArchivedProjects } from "@/lib/projects";
import { AppNav } from "@/components/app-nav";
import { NewProjectButton } from "./new-project-dialog";
import { ArchivedProjects } from "./archived-projects";

export const metadata: Metadata = {
    title: "Studio",
};

export default async function StudioPage() {
    const { user } = await requireOnboardedUser();

    const [balance, projects, archivedProjects] = await Promise.all([
        getBalance(user.id),
        listProjects(user.id),
        listArchivedProjects(user.id),
    ]);

    const totalCredits =
        balance.subscriptionCredits + balance.purchasedCredits;

    return (
        <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
            <AppNav />

            <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                            Welcome back, {user.name?.split(" ")[0]}
                        </h1>
                        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                            {Intl.NumberFormat("en-US").format(totalCredits)} credits
                            remaining · {balance.plan.charAt(0).toUpperCase() + balance.plan.slice(1)} plan
                        </p>
                    </div>
                </div>

                {/* Projects section */}
                <section className="mt-8">
                    <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
                        Projects
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                        Organize your generations into projects.
                    </p>

                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <NewProjectButton />

                        {projects.map((project) => (
                            <ProjectCard
                                key={project.uid}
                                uid={project.uid}
                                name={project.name}
                                coverImageUrl={project.coverImageUrl}
                                generationCount={project.generationCount}
                                updatedAt={project.updatedAt}
                            />
                        ))}
                    </div>
                </section>

                {/* Archived projects — collapsible */}
                <ArchivedProjects projects={archivedProjects} />
            </main>
        </div>
    );
}

// ─── Project card ───────────────────────────────────────────────────────────

interface ProjectCardProps {
    uid: string;
    name: string;
    coverImageUrl: string | null;
    generationCount: number;
    updatedAt: number;
}

function ProjectCard({
    uid,
    name,
    coverImageUrl,
    generationCount,
    updatedAt,
}: ProjectCardProps) {
    return (
        <Link
            href={`/projects/${uid}`}
            className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950 dark:hover:shadow-neutral-900/30"
        >
            {/* Cover image */}
            <div className="relative aspect-[16/10] bg-neutral-100 dark:bg-neutral-900">
                {coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={coverImageUrl}
                        alt={name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
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

            {/* Info */}
            <div className="p-4">
                <h3 className="truncate text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                    {name}
                </h3>
                <div className="mt-1.5 flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500">
                    <span>
                        {generationCount} image{generationCount !== 1 ? "s" : ""}
                    </span>
                    <span>{formatTimeAgo(updatedAt)}</span>
                </div>
            </div>
        </Link>
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
