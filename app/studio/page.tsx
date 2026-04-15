/**
 * Studio — the home for signed-in users.
 *
 * Shows: credit balance, project grid with cover images, and a
 * "New project" CTA. Projects are the primary organizational unit —
 * all generations live within a project.
 *
 * Always dark-themed to match the project workspace aesthetic.
 * Server component — fetches balance + projects server-side.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { requireOnboardedUser } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { listProjects, listArchivedProjects } from "@/lib/projects";
import { NavUserMenu } from "@/components/nav-user-menu";
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
    const planLabel =
        balance.plan.charAt(0).toUpperCase() + balance.plan.slice(1);

    return (
        <div className="min-h-dvh bg-[#0f0f11] text-white">
            {/* Header */}
            <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6 sm:py-5">
                <Link
                    href="/studio"
                    className="text-[14px] font-semibold tracking-tight"
                >
                    Film-maker
                </Link>

                <div className="flex-1" />

                {/* Credits badge */}
                <Link
                    href="/credits"
                    className="flex h-[34px] items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 text-sm tabular-nums text-[#9ca3af] transition-colors hover:border-white/[0.15] hover:text-white"
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
                        aria-hidden
                    >
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    {Intl.NumberFormat("en-US").format(totalCredits)}
                </Link>

                {/* User menu */}
                <NavUserMenu
                    name={user.name ?? ""}
                    email={user.email}
                />
            </header>

            <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
                {/* Welcome */}
                <div className="mt-4 sm:mt-6">
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                        Welcome back, {user.name?.split(" ")[0]}
                    </h1>
                    <p className="mt-1 text-sm text-[#9ca3af]">
                        {Intl.NumberFormat("en-US").format(totalCredits)} credits remaining · {planLabel} plan
                    </p>
                </div>

                {/* Projects */}
                <section className="mt-10">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Projects</h2>
                    </div>
                    <p className="mt-1 text-sm text-[#52525b]">
                        Organize your generations into projects.
                    </p>

                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
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

                {/* Archived projects */}
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
            className="group overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.06] transition-all hover:ring-white/[0.12]"
        >
            {/* Cover image */}
            <div className="relative aspect-[16/10] bg-white/[0.02]">
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
                            className="text-[#2a2a2d]"
                            aria-hidden
                        >
                            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="p-4">
                <h3 className="truncate text-sm font-semibold">
                    {name}
                </h3>
                <div className="mt-1.5 flex items-center justify-between text-xs text-[#52525b]">
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
