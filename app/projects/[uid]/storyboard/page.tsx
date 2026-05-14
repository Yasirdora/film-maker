/**
 * Storyboard route — `/projects/[uid]/storyboard`.
 *
 * Server entry for the storyboard surface. Auth-guards, loads the
 * board (lazy-creates on first visit), and hands it to the client
 * workspace. Cards, edits, and drag-reorders all flow through the
 * client store + REST API.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireOnboardedUser } from "@/lib/auth-server";
import { getProject } from "@/lib/projects";
import { getOrCreateStoryboard } from "@/lib/storyboards";
import { AppNav } from "@/components/app-nav";
import { ProjectSettings } from "../project-settings";
import { ProjectViewTabs } from "../project-view-tabs";

import { StoryboardWorkspace } from "./storyboard-workspace";

interface PageProps {
    params: Promise<{ uid: string }>;
}

export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { uid } = await params;
    const { user } = await requireOnboardedUser();
    const project = await getProject(uid, user.id);
    return {
        title: project ? `${project.name} — Storyboard` : "Storyboard",
        description:
            "Plan scenes and shots before generation. Drag to reorder.",
    };
}

export default async function StoryboardPage({ params }: PageProps) {
    const { uid } = await params;
    const { user } = await requireOnboardedUser();

    const project = await getProject(uid, user.id);
    if (!project) notFound();

    const board = await getOrCreateStoryboard(uid, user.id);

    return (
        <div className="flex h-dvh flex-col bg-ws-canvas pb-[66px] sm:pb-0">
            <AppNav brandHref="/studio" />

            <div className="px-4 pt-4 sm:px-8 sm:pt-6">
                <ProjectSettings
                    uid={project.uid}
                    name={project.name}
                    description={project.description}
                    pinnedAt={project.pinnedAt}
                />
            </div>

            <ProjectViewTabs projectUid={project.uid} />

            <div className="flex-1 overflow-y-auto">
                <StoryboardWorkspace initial={board} />
            </div>
        </div>
    );
}
