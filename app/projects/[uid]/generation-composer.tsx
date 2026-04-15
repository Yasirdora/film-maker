"use client";

/**
 * GenerationComposer — floating prompt input bar.
 *
 * Pinned to the bottom of the workspace. Contains:
 *   • Text input for the prompt
 *   • Mode toggle (Image — Video is disabled for v0)
 *   • Aspect ratio quick-toggle (flips landscape ↔ portrait)
 *   • Settings gear (opens ComposerSettings modal above)
 *   • Generate button (submit)
 *
 * The composer manages its own local state (prompt, settings modal,
 * generating flag) and communicates with the workspace via callbacks.
 */

import { useState, useRef, useCallback } from "react";
import {
    ComposerSettings,
    type ComposerSettingsState,
    type Model,
} from "./composer-settings";

// ─── Ratio quick-toggle pairs ───────────────────────────────────────────────

const LANDSCAPE_PORTRAIT_PAIRS: Record<string, string> = {
    "16:9": "9:16",
    "9:16": "16:9",
    "3:2": "2:3",
    "2:3": "3:2",
    "4:3": "3:4",
    "3:4": "4:3",
    "1:1": "1:1",
};

// ─── Resolution multipliers (client-side preview, server is authoritative) ──

const RESOLUTION_MULTIPLIERS: Record<string, number> = {
    "1K": 1,
    "2K": 2,
    "4K": 4,
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface GenerationComposerProps {
    projectUid: string;
    models: Model[];
    availableResolutions: string[];
    planName: string;
    credits: number;
    onGenerationStart: (placeholder: {
        prompt: string;
        resolution: string;
        aspectRatio: string;
    }) => void;
    onGenerationComplete: (result: {
        uid: string;
        imageUrl: string;
        creditCost: number;
        prompt: string;
        resolution: string;
        aspectRatio: string;
    }) => void;
    onGenerationError: (prompt: string, errorMessage: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function GenerationComposer({
    projectUid,
    models,
    availableResolutions,
    planName,
    credits,
    onGenerationStart,
    onGenerationComplete,
    onGenerationError,
}: GenerationComposerProps) {
    const [prompt, setPrompt] = useState("");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [settings, setSettings] = useState<ComposerSettingsState>({
        model: models[0]?.id ?? "",
        aspectRatio: "16:9",
        sampleCount: 1,
    });
    const abortRef = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedModel = models.find((m) => m.id === settings.model);
    const resolution = availableResolutions[availableResolutions.length - 1] ?? "1K";
    const creditCost =
        (selectedModel?.creditBase ?? 1) *
        (RESOLUTION_MULTIPLIERS[resolution] ?? 1) *
        settings.sampleCount;

    const canGenerate =
        !isGenerating &&
        prompt.trim().length > 0 &&
        credits >= creditCost;

    // ─── Submit ─────────────────────────────────────────────────────

    const handleGenerate = useCallback(async () => {
        if (!canGenerate) return;

        const trimmedPrompt = prompt.trim();
        const idempotencyKey = crypto.randomUUID();
        abortRef.current = new AbortController();

        setIsGenerating(true);
        onGenerationStart({
            prompt: trimmedPrompt,
            resolution,
            aspectRatio: settings.aspectRatio,
        });

        try {
            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: trimmedPrompt,
                    model: settings.model,
                    resolution,
                    aspectRatio: settings.aspectRatio,
                    projectUid,
                    idempotencyKey,
                }),
                signal: abortRef.current.signal,
            });

            const data = (await res.json()) as {
                uid?: string;
                imageUrl?: string;
                creditCost?: number;
                error?: string;
            };

            if (!res.ok) {
                onGenerationError(
                    trimmedPrompt,
                    data.error ?? "Generation failed.",
                );
            } else {
                onGenerationComplete({
                    uid: data.uid ?? "",
                    imageUrl: data.imageUrl ?? "",
                    creditCost: data.creditCost ?? creditCost,
                    prompt: trimmedPrompt,
                    resolution,
                    aspectRatio: settings.aspectRatio,
                });
                setPrompt("");
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                // User cancelled — remove the pending placeholder.
                onGenerationError(trimmedPrompt, "Cancelled");
            } else {
                onGenerationError(
                    trimmedPrompt,
                    err instanceof Error
                        ? err.message
                        : "Generation failed. Please try again.",
                );
            }
        } finally {
            setIsGenerating(false);
        }
    }, [
        canGenerate,
        prompt,
        settings,
        resolution,
        creditCost,
        projectUid,
        onGenerationStart,
        onGenerationComplete,
        onGenerationError,
    ]);

    // ─── Keyboard submit ────────────────────────────────────────────

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleGenerate();
        }
    }

    // ─── Ratio quick-toggle ─────────────────────────────────────────

    function handleRatioToggle() {
        const flipped =
            LANDSCAPE_PORTRAIT_PAIRS[settings.aspectRatio] ??
            settings.aspectRatio;
        setSettings((s) => ({ ...s, aspectRatio: flipped }));
    }

    // ─── Is the current ratio landscape? ────────────────────────────

    const isLandscape =
        settings.aspectRatio === "16:9" ||
        settings.aspectRatio === "3:2" ||
        settings.aspectRatio === "4:3";

    return (
        <div className="relative shrink-0 px-3 pb-3 sm:pb-8 sm:px-0">
            <div className="mx-auto w-full sm:max-w-[600px]">
                {/* Composer bar */}
                <div className="flex flex-col gap-2.5 rounded-2xl bg-[#1a1a1c]/90 p-2.5 ring-1 ring-white/[0.08] shadow-[0_-4px_24px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:p-3">
                    {/* Input row */}
                    <div className="flex items-center px-1 py-0.5">
                        <input
                            ref={inputRef}
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Describe your image..."
                            disabled={isGenerating}
                            className="flex-1 bg-transparent text-[16px] text-white placeholder-[#52525b] outline-none disabled:opacity-50"
                            autoComplete="off"
                        />
                    </div>

                    {/* Controls row */}
                    <div className="relative flex items-center gap-1.5 px-0.5">
                        {/* Settings popover — full-width, above the controls row */}
                        <ComposerSettings
                            models={models}
                            settings={settings}
                            onSettingsChange={setSettings}
                            open={settingsOpen}
                            onClose={() => setSettingsOpen(false)}
                        />

                        {/* Mode toggle — Image only for v0 */}
                        <div className="flex h-[36px] items-center rounded-[10px] bg-[#2a2a2d] p-[3px]">
                            <div className="flex items-center gap-1.5 rounded-lg bg-[#1c1c1c] px-3 h-full">
                                <svg
                                    className="shrink-0 text-[#9ca3af]"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 13 13"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.17"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M4.583 5.75a1.167 1.167 0 1 0 0-2.333 1.167 1.167 0 0 0 0 2.333Z" />
                                    <path d="M.583 2.917A2.333 2.333 0 0 1 2.917.583h7a2.333 2.333 0 0 1 2.333 2.334v7a2.333 2.333 0 0 1-2.333 2.333h-7A2.333 2.333 0 0 1 .583 9.917V2.917Z" />
                                    <path d="m2.917 12.25 4.958-4.958a1.167 1.167 0 0 1 1.633 0l2.742 2.625" />
                                </svg>
                                <span className="text-[13px] font-medium text-[#9ca3af]">
                                    Image
                                </span>
                            </div>
                        </div>

                        {/* Ratio quick-toggle */}
                        <button
                            type="button"
                            onClick={handleRatioToggle}
                            className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] bg-[#2a2a2d] transition-colors hover:bg-[#353538]"
                            aria-label={`Aspect ratio: ${settings.aspectRatio}`}
                        >
                            <svg
                                className={`text-[#9ca3af] transition-transform duration-300 ${
                                    !isLandscape ? "rotate-90" : ""
                                }`}
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect x="3" y="7" width="18" height="10" rx="2" />
                            </svg>
                        </button>

                        {/* Settings gear */}
                        <button
                            type="button"
                            onClick={() => setSettingsOpen((o) => !o)}
                            className={`flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] transition-colors ${
                                settingsOpen
                                    ? "border border-white/20 bg-[#323235]"
                                    : "bg-[#2a2a2d] hover:bg-[#353538]"
                            }`}
                            aria-label="Generation settings"
                        >
                            <svg
                                className="text-[#9ca3af]"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        </button>

                        <div className="flex-1" />

                        {/* Credit cost indicator */}
                        {prompt.trim().length > 0 && (
                            <span className="mr-1 text-[12px] tabular-nums text-[#52525b]">
                                {creditCost} cr
                            </span>
                        )}

                        {/* Generate button */}
                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={!canGenerate}
                            className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] bg-white text-black transition-colors hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-white"
                            aria-label="Generate"
                        >
                            {isGenerating ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                            ) : (
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <line x1="12" y1="19" x2="12" y2="5" />
                                    <polyline points="5 12 12 5 19 12" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
