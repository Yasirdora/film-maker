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

import { useCallback, useRef, useState } from "react";
import { GenerationGallery } from "./generation-gallery";
import {
    GenerationComposer,
    type ComposerMode,
    type GenerationComposerHandle,
} from "./generation-composer";

// ─── Types ──────────────────────────────────────────────────────────────────

export type GenerationKind = "image" | "video";

export interface GenerationItem {
    uid: string;
    prompt: string;
    kind: GenerationKind;
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

interface VideoModel {
    id: string;
    name: string;
    description: string;
    creditBase: number;
}

interface ProjectWorkspaceProps {
    projectUid: string;
    initialGenerations: GenerationItem[];
    models: Model[];
    videoModels: VideoModel[];
    availableResolutions: string[];
    planName: string;
    totalCredits: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ProjectWorkspace({
    projectUid,
    initialGenerations,
    models,
    videoModels,
    availableResolutions,
    planName,
    totalCredits,
}: ProjectWorkspaceProps) {
    const [generations, setGenerations] = useState<GenerationItem[]>(
        initialGenerations,
    );
    const [credits, setCredits] = useState(totalCredits);
    const composerRef = useRef<GenerationComposerHandle>(null);

    const handleGenerationComplete = useCallback(
        (result: {
            uid: string;
            imageUrls: string[];
            creditCost: number;
            prompt: string;
            resolution: string;
            aspectRatio: string;
            kind: ComposerMode;
        }) => {
            setGenerations((prev) => {
                // Build gallery items from the result — one per image/video.
                const newItems: GenerationItem[] = result.imageUrls.map(
                    (url, i) => ({
                        uid: result.imageUrls.length > 1
                            ? `${result.uid}-${i}`
                            : result.uid,
                        prompt: result.prompt,
                        kind: result.kind as GenerationKind,
                        status: "done" as const,
                        resolution: result.resolution,
                        aspectRatio: result.aspectRatio,
                        imageUrl: url,
                        creditCost: i === 0 ? result.creditCost : 0,
                        createdAt: Date.now(),
                        errorMessage: null,
                    }),
                );

                // Replace all pending placeholders for this prompt with results.
                const firstPendingIdx = prev.findIndex(
                    (g) => g.status === "pending" && g.prompt === result.prompt,
                );
                if (firstPendingIdx !== -1) {
                    // Count consecutive pending items with the same prompt.
                    let pendingCount = 0;
                    for (let i = firstPendingIdx; i < prev.length; i++) {
                        if (prev[i].status === "pending" && prev[i].prompt === result.prompt) {
                            pendingCount++;
                        } else {
                            break;
                        }
                    }
                    const next = [...prev];
                    next.splice(firstPendingIdx, pendingCount, ...newItems);
                    return next;
                }
                // No pending match — prepend all items.
                return [...newItems, ...prev];
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
            sampleCount: number;
            kind: ComposerMode;
        }) => {
            const now = Date.now();
            const pending: GenerationItem[] = Array.from(
                { length: placeholder.sampleCount },
                (_, i) => ({
                    uid: `pending-${now}-${i}`,
                    prompt: placeholder.prompt,
                    kind: placeholder.kind as GenerationKind,
                    status: "pending" as const,
                    resolution: placeholder.resolution,
                    aspectRatio: placeholder.aspectRatio,
                    imageUrl: null,
                    creditCost: 0,
                    createdAt: now,
                    errorMessage: null,
                }),
            );
            setGenerations((prev) => [...pending, ...prev]);
        },
        [],
    );

    const handleGenerationError = useCallback(
        (prompt: string, errorMessage: string) => {
            setGenerations((prev) =>
                prev.map((g) =>
                    g.status === "pending" && g.prompt === prompt
                        ? { ...g, status: "failed" as const, errorMessage }
                        : g,
                ),
            );
        },
        [],
    );

    // ─── Gallery card actions ──────────────────────────────────────

    const handleReusePrompt = useCallback((prompt: string) => {
        composerRef.current?.setPrompt(prompt);
    }, []);

    const handleUseAsReference = useCallback(async (imageUrl: string) => {
        try {
            await composerRef.current?.attachReferenceFromUrl(imageUrl);
        } catch (err) {
            console.error("[workspace] Failed to attach reference image:", err);
        }
    }, []);

    const handleRegenerate = useCallback((generation: GenerationItem) => {
        composerRef.current?.applySnapshot({
            prompt: generation.prompt,
            aspectRatio: generation.aspectRatio,
            kind: generation.kind,
        });
        // applySnapshot uses flushSync, so state is already committed —
        // the submit closure sees the restored prompt / aspect / mode.
        composerRef.current?.submit();
    }, []);

    const handleDeleteGeneration = useCallback(async (uid: string) => {
        // Snapshot the current list so we can roll back if the server
        // rejects the delete (auth lapse, network flake, etc.).
        let removed: GenerationItem | null = null;
        setGenerations((prev) => {
            const found = prev.find((g) => g.uid === uid);
            if (!found) return prev;
            removed = found;
            return prev.filter((g) => g.uid !== uid);
        });
        if (!removed) return;

        try {
            const res = await fetch(`/api/generations/${uid}`, {
                method: "DELETE",
            });
            if (!res.ok && res.status !== 404) {
                throw new Error(`Delete failed (${res.status})`);
            }
        } catch (err) {
            console.error("[workspace] Failed to delete generation:", err);
            // Restore so the user sees it again and can retry.
            if (removed) {
                const restored = removed;
                setGenerations((prev) => [restored, ...prev]);
            }
        }
    }, []);

    return (
        <div className="relative flex min-h-0 flex-1 flex-col text-white">
            {/* Gallery — fills remaining space. Bottom padding reserves
                room for the floating composer so the last row isn't
                permanently hidden behind it. */}
            <div className="flex-1 overflow-y-auto pb-40 sm:pb-44">
                <GenerationGallery
                    generations={generations}
                    onReusePrompt={handleReusePrompt}
                    onUseAsReference={handleUseAsReference}
                    onRegenerate={handleRegenerate}
                    onDelete={handleDeleteGeneration}
                />
            </div>

            {/* Composer — floats over the gallery so its backdrop-blur
                has content to blur (previously it sat as a sibling
                below the gallery and rendered on bare page bg). */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0">
                <div className="pointer-events-auto">
                    <GenerationComposer
                        ref={composerRef}
                        projectUid={projectUid}
                        models={models}
                        videoModels={videoModels}
                        availableResolutions={availableResolutions}
                        planName={planName}
                        credits={credits}
                        onGenerationStart={handleGenerationStart}
                        onGenerationComplete={handleGenerationComplete}
                        onGenerationError={handleGenerationError}
                    />
                </div>
            </div>
        </div>
    );
}
