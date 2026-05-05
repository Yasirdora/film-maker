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
import {
    getPlan,
    isFreePlan,
    PHOTO_MODELS,
    VIDEO_MODELS,
    RESOLUTIONS,
    SOLO_ALLOWED_VIDEO_MODEL_IDS,
} from "@/lib/constants";
import { AppHeader } from "@/components/app-header";
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

    // Solo (free) plan only sees the cheapest video model in the composer.
    const availableVideoModels = isFreePlan(balance.plan)
        ? VIDEO_MODELS.filter((m) =>
              (SOLO_ALLOWED_VIDEO_MODEL_IDS as readonly string[]).includes(m.id),
          )
        : VIDEO_MODELS;

    const totalCredits =
        balance.subscriptionCredits + balance.purchasedCredits;

    // Map GenerationRow → GenerationItem(s) for the client component.
    // Batch generations (multiple output URLs) expand into one gallery
    // item per image so the grid displays each result individually.
    //
    // Server-loaded items are always resolved (done or failed) — the DB
    // only stores completed generations. The discriminated union requires
    // us to build the correct variant for each status.
    const generationItems = generations.flatMap((g) => {
        const urls = g.outputUrls ?? (g.thumbnailUrls ? g.thumbnailUrls : []);

        /** Shared base fields for every item mapped from this row. */
        const base = {
            prompt: g.prompt,
            kind: g.kind,
            resolution: g.resolution,
            aspectRatio: g.aspectRatio,
            createdAt: g.createdAt,
        } as const;

        /** Build a single GenerationItem for one URL (or no URL). */
        function toItem(uid: string, url: string | undefined, creditCost: number) {
            if (g.status === "failed") {
                return {
                    ...base,
                    uid,
                    status: "failed" as const,
                    creditCost,
                    errorMessage: g.errorMessage ?? "Generation failed",
                    generationKey: null,
                };
            }
            // "done" or any other resolved status from the DB.
            return {
                ...base,
                uid,
                status: "done" as const,
                creditCost,
                imageUrl: url ?? "",
                generationKey: null,
            };
        }

        // Single (or zero) output — one gallery item.
        if (urls.length <= 1) {
            return [toItem(g.uid, urls[0], g.creditCost)];
        }

        // Multiple outputs — expand into one item per URL.
        return urls.map((url, i) =>
            toItem(`${g.uid}-${i}`, url, i === 0 ? g.creditCost : 0),
        );
    });

    return (
        <div className="flex h-dvh flex-col bg-ws-canvas pb-[66px] sm:pb-0">
            <AppNav />

            <AppHeader brandHref="/studio">
                <ProjectSettings
                    uid={project.uid}
                    name={project.name}
                    description={project.description}
                    pinnedAt={project.pinnedAt}
                />
            </AppHeader>

            <ProjectWorkspace
                projectUid={project.uid}
            initialGenerations={generationItems}
            models={PHOTO_MODELS.map((m) => ({
                id: m.id,
                name: m.name,
                description: m.description,
                creditBase: m.creditBase,
            }))}
            videoModels={availableVideoModels.map((m) => ({
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
