/**
 * Studio — the home for signed-in users.
 *
 * Shows: credit balance, project grid with cover images, and a
 * "Create project" CTA. Projects are the primary organizational unit —
 * all generations live within a project.
 *
 * Always dark-themed to match the project workspace aesthetic.
 * Server component — fetches balance + projects server-side and hands
 * each project to the client-side `ProjectCard`, which owns its own
 * action menu + dialogs.
 */

import type { Metadata } from "next";

import { requireOnboardedUser } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { listProjects, listArchivedProjects } from "@/lib/projects";
import { AppBrandMark } from "@/components/app-brand-mark";
import { AppNav } from "@/components/app-nav";
import { NewProjectButton } from "./new-project-dialog";
import { ArchivedProjects } from "./archived-projects";
import { ProjectCard } from "./project-card";

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
        <div className="min-h-dvh bg-[#0f0f11] text-white pb-[66px] sm:pb-0">
            <AppNav />

            {/* Brand mark — pinned to the top-left of the viewport so
                it sits opposite the AppNav cluster (which anchors
                top-right on desktop). Sibling of <AppNav /> rather
                than nested in <main> so the left padding matches the
                nav's right padding on wide screens. */}
            <div className="px-4 pt-4 sm:px-6">
                <AppBrandMark size="sm" />
            </div>

            <main className="mx-auto max-w-[85rem] px-4 pb-8 sm:px-6">
                {/* Welcome */}
                <div className="mt-6 sm:mt-8">
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                        Welcome back, {user.name?.split(" ")[0]}
                    </h1>
                    <p className="mt-1 text-sm text-[#9ca3af]">
                        {Intl.NumberFormat("en-US").format(totalCredits)} credits remaining · {planLabel} plan
                    </p>
                </div>

                {/* Projects */}
                <section className="mt-10">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-semibold">
                                Projects
                                {projects.length > 0 && (
                                    <span className="ml-2 text-sm font-medium text-[#52525b]">
                                        {projects.length}
                                    </span>
                                )}
                            </h2>
                            <p className="mt-1 text-sm text-[#52525b]">
                                Organize your generations into projects.
                            </p>
                        </div>
                        {projects.length > 0 && (
                            <div className="shrink-0">
                                <NewProjectButton variant="header" />
                            </div>
                        )}
                    </div>

                    {projects.length === 0 ? (
                        <div className="mt-6">
                            <NewProjectButton variant="empty" />
                        </div>
                    ) : (
                        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 min-[1400px]:grid-cols-4 sm:gap-4">
                            {projects.map((project) => (
                                <ProjectCard
                                    key={project.uid}
                                    project={{
                                        uid: project.uid,
                                        name: project.name,
                                        coverImageUrl: project.coverImageUrl,
                                        imageCount: project.imageCount,
                                        videoCount: project.videoCount,
                                        pinnedAt: project.pinnedAt,
                                        updatedAt: project.updatedAt,
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* Archived projects */}
                <ArchivedProjects projects={archivedProjects} />
            </main>
        </div>
    );
}
