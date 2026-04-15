/**
 * /projects/[uid] — project workspace.
 *
 * The core generation interface. Combines a scrollable gallery of
 * existing generations with a floating composer bar for creating new
 * images. Always dark-themed to keep focus on the visual content.
 *
 * Server component — fetches project, generations, balance, and plan
 * data, then hands everything to the client-side ProjectWorkspace.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireOnboardedUser } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { getProject } from "@/lib/projects";
import { listGenerationsByProject } from "@/lib/generations";
import { getPlan, PHOTO_MODELS, RESOLUTIONS } from "@/lib/constants";
import { AppNav } from "@/components/app-nav";
import { ProjectWorkspace } from "./project-workspace";

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

export default async function ProjectPage({ params }: PageProps) {
    const { uid } = await params;
    const { user } = await requireOnboardedUser();

    const project = await getProject(uid, user.id);
    if (!project) notFound();
    if (project.archivedAt) notFound();

    const [generations, balance] = await Promise.all([
        listGenerationsByProject(project.id, user.id, 100),
        getBalance(user.id),
    ]);

    const plan = getPlan(balance.plan);
    const maxResolution = plan?.maxResolution ?? "1K";
    const maxIdx = RESOLUTIONS.indexOf(maxResolution);
    const availableResolutions = RESOLUTIONS.filter((_, i) => i <= maxIdx);

    const totalCredits =
        balance.subscriptionCredits + balance.purchasedCredits;

    // Map GenerationRow → GenerationItem for the client component.
    const generationItems = generations.map((g) => ({
        uid: g.uid,
        prompt: g.prompt,
        status: g.status,
        resolution: g.resolution,
        aspectRatio: g.aspectRatio,
        imageUrl: g.thumbnailUrls?.[0] ?? g.outputUrls?.[0] ?? null,
        creditCost: g.creditCost,
        createdAt: g.createdAt,
        errorMessage: g.errorMessage,
    }));

    return (
        <div className="flex h-dvh flex-col bg-[#0f0f11] pb-[66px] sm:pb-0">
            <AppNav />
            <ProjectWorkspace
                project={{
                uid: project.uid,
                name: project.name,
                description: project.description,
            }}
            initialGenerations={generationItems}
            models={PHOTO_MODELS.map((m) => ({
                id: m.id,
                name: m.name,
                description: m.description,
                creditBase: m.creditBase,
            }))}
            availableResolutions={[...availableResolutions]}
            planName={plan?.name ?? "Solo"}
            totalCredits={totalCredits}
        />
        </div>
    );
}
