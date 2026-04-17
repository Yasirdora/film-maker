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
import { getPlan, PHOTO_MODELS, VIDEO_MODELS, RESOLUTIONS } from "@/lib/constants";
import { AppBrandMark } from "@/components/app-brand-mark";
import { AppNav } from "@/components/app-nav";
import { ProjectWorkspace } from "./project-workspace";
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

    // Map GenerationRow → GenerationItem(s) for the client component.
    // Batch generations (multiple output URLs) expand into one gallery
    // item per image so the grid displays each result individually.
    const generationItems = generations.flatMap((g) => {
        const urls = g.outputUrls ?? (g.thumbnailUrls ? g.thumbnailUrls : []);

        // No images (pending/failed) or single image/video — one item.
        if (urls.length <= 1) {
            return [{
                uid: g.uid,
                prompt: g.prompt,
                kind: g.kind,
                status: g.status,
                resolution: g.resolution,
                aspectRatio: g.aspectRatio,
                imageUrl: urls[0] ?? null,
                creditCost: g.creditCost,
                createdAt: g.createdAt,
                errorMessage: g.errorMessage,
            }];
        }

        // Multiple images — expand into separate items.
        return urls.map((url, i) => ({
            uid: `${g.uid}-${i}`,
            prompt: g.prompt,
            kind: g.kind,
            status: g.status,
            resolution: g.resolution,
            aspectRatio: g.aspectRatio,
            imageUrl: url,
            creditCost: i === 0 ? g.creditCost : 0,
            createdAt: g.createdAt,
            errorMessage: g.errorMessage,
        }));
    });

    return (
        <div className="flex h-dvh flex-col bg-[#0f0f11] pb-[66px] sm:pb-0">
            <AppNav />

            {/* Unified page header: brand mark at far left (back to
                /studio), project title + ⋯ actions next to it. On
                desktop we reserve room on the right so the absolute
                AppNav cluster can't overlap the title. */}
            <header className="flex shrink-0 items-center gap-3 px-4 pt-4 pb-2 sm:gap-4 sm:px-6 sm:pb-3 sm:pr-64">
                <AppBrandMark href="/studio" size="sm" />
                <ProjectSettings
                    uid={project.uid}
                    name={project.name}
                    description={project.description}
                    pinnedAt={project.pinnedAt}
                />
            </header>

            <ProjectWorkspace
                projectUid={project.uid}
            initialGenerations={generationItems}
            models={PHOTO_MODELS.map((m) => ({
                id: m.id,
                name: m.name,
                description: m.description,
                creditBase: m.creditBase,
            }))}
            videoModels={VIDEO_MODELS.map((m) => ({
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
