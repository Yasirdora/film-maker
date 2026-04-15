"use client";

/**
 * ProjectWorkspace — the main generation interface.
 *
 * Orchestrates the gallery (scrollable grid of past generations) and
 * the floating composer bar (prompt input + settings). Manages the
 * generation lifecycle: idle → generating → result appears in gallery.
 *
 * State ownership:
 *   • generations[]     — local array, updated optimistically on submit
 *   • credits           — local counter, decremented on successful generation
 *   • composerSettings  — aspect ratio, model, batch count
 *
 * The workspace is always dark-themed to keep visual focus on images.
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { GenerationGallery } from "./generation-gallery";
import { GenerationComposer } from "./generation-composer";
import { ProjectSettings } from "./project-settings";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GenerationItem {
    uid: string;
    prompt: string;
    status: "pending" | "done" | "failed";
    resolution: string;
    aspectRatio: string | null;
    imageUrl: string | null;
    creditCost: number;
    createdAt: number;
    errorMessage: string | null;
}

interface Model {
    id: string;
    name: string;
    description: string;
    creditBase: number;
}

interface ProjectWorkspaceProps {
    project: {
        uid: string;
        name: string;
        description: string | null;
    };
    initialGenerations: GenerationItem[];
    models: Model[];
    availableResolutions: string[];
    planName: string;
    totalCredits: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ProjectWorkspace({
    project,
    initialGenerations,
    models,
    availableResolutions,
    planName,
    totalCredits,
}: ProjectWorkspaceProps) {
    const [generations, setGenerations] = useState<GenerationItem[]>(
        initialGenerations,
    );
    const [credits, setCredits] = useState(totalCredits);

    const handleGenerationComplete = useCallback(
        (result: {
            uid: string;
            imageUrl: string;
            creditCost: number;
            prompt: string;
            resolution: string;
            aspectRatio: string;
        }) => {
            setGenerations((prev) => {
                // Replace the pending placeholder with the completed result.
                const pending = prev.find(
                    (g) => g.status === "pending" && g.prompt === result.prompt,
                );
                if (pending) {
                    return prev.map((g) =>
                        g === pending
                            ? {
                                  ...g,
                                  uid: result.uid,
                                  status: "done" as const,
                                  imageUrl: result.imageUrl,
                                  creditCost: result.creditCost,
                              }
                            : g,
                    );
                }
                // No pending match — prepend as new item.
                return [
                    {
                        uid: result.uid,
                        prompt: result.prompt,
                        status: "done",
                        resolution: result.resolution,
                        aspectRatio: result.aspectRatio,
                        imageUrl: result.imageUrl,
                        creditCost: result.creditCost,
                        createdAt: Date.now(),
                        errorMessage: null,
                    },
                    ...prev,
                ];
            });
            setCredits((c) => c - result.creditCost);
        },
        [],
    );

    const handleGenerationStart = useCallback(
        (placeholder: {
            prompt: string;
            resolution: string;
            aspectRatio: string;
        }) => {
            setGenerations((prev) => [
                {
                    uid: `pending-${Date.now()}`,
                    prompt: placeholder.prompt,
                    status: "pending",
                    resolution: placeholder.resolution,
                    aspectRatio: placeholder.aspectRatio,
                    imageUrl: null,
                    creditCost: 0,
                    createdAt: Date.now(),
                    errorMessage: null,
                },
                ...prev,
            ]);
        },
        [],
    );

    const handleGenerationError = useCallback(
        (prompt: string, errorMessage: string) => {
            setGenerations((prev) => {
                const pending = prev.find(
                    (g) => g.status === "pending" && g.prompt === prompt,
                );
                if (pending) {
                    return prev.map((g) =>
                        g === pending
                            ? { ...g, status: "failed" as const, errorMessage }
                            : g,
                    );
                }
                return prev;
            });
        },
        [],
    );

    return (
        <div className="flex h-dvh flex-col bg-[#0f0f11] text-white">
            {/* Header */}
            <header className="flex shrink-0 items-center px-5 h-[48px] sm:px-8 sm:h-[56px]">
                <Link
                    href="/studio"
                    className="mr-3 text-[#9ca3af] transition-colors hover:text-white"
                    aria-label="Back to studio"
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
                <div className="flex-1" />
                <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 h-[34px] text-sm tabular-nums text-[#9ca3af]">
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
                    {Intl.NumberFormat("en-US").format(credits)}
                </div>
            </header>

            {/* Gallery — fills available space, scrollable */}
            <div className="flex-1 overflow-y-auto">
                <GenerationGallery generations={generations} />
            </div>

            {/* Composer — pinned to bottom */}
            <GenerationComposer
                projectUid={project.uid}
                models={models}
                availableResolutions={availableResolutions}
                planName={planName}
                credits={credits}
                onGenerationStart={handleGenerationStart}
                onGenerationComplete={handleGenerationComplete}
                onGenerationError={handleGenerationError}
            />
        </div>
    );
}
