"use client";

/**
 * GenerateForm — the core image generation interface.
 *
 * Two-panel layout:
 *   Desktop: form (left) + canvas/result (right)
 *   Mobile: form (top) + canvas/result (bottom)
 *
 * State machine:
 *   idle → generating → done/error → idle (reset)
 *
 * Every generation is scoped to a project. The project UID is passed
 * as a prop from the server component and sent with each API request.
 *
 * The form generates a UUID v4 idempotency key on each submit to
 * prevent double-charge on network retry.
 */

import { useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const ASPECT_RATIOS = [
    { value: "1:1", label: "1:1" },
    { value: "16:9", label: "16:9" },
    { value: "9:16", label: "9:16" },
    { value: "4:3", label: "4:3" },
    { value: "3:4", label: "3:4" },
    { value: "3:2", label: "3:2" },
    { value: "2:3", label: "2:3" },
] as const;

const RESOLUTION_MULTIPLIERS: Record<string, number> = {
    "1K": 1,
    "2K": 2,
    "4K": 4,
};

interface Model {
    id: string;
    name: string;
    creditBase: number;
}

interface GenerateFormProps {
    projectUid: string;
    projectName: string;
    models: Model[];
    availableResolutions: string[];
    planName: string;
    maxResolution: string;
    totalCredits: number;
}

type FormState =
    | { kind: "idle" }
    | { kind: "generating" }
    | { kind: "done"; imageUrl: string; creditCost: number }
    | { kind: "error"; message: string };

export function GenerateForm({
    projectUid,
    projectName,
    models,
    availableResolutions,
    planName,
    maxResolution,
    totalCredits,
}: GenerateFormProps) {
    const [prompt, setPrompt] = useState("");
    const [negativePrompt, setNegativePrompt] = useState("");
    const [showNegative, setShowNegative] = useState(false);
    const [model, setModel] = useState(models[0]?.id ?? "");
    const [resolution, setResolution] = useState(availableResolutions[0] ?? "1K");
    const [aspectRatio, setAspectRatio] = useState("1:1");
    const [state, setState] = useState<FormState>({ kind: "idle" });
    const [credits, setCredits] = useState(totalCredits);
    const abortRef = useRef<AbortController | null>(null);

    const selectedModel = models.find((m) => m.id === model);
    const creditCost =
        (selectedModel?.creditBase ?? 1) *
        (RESOLUTION_MULTIPLIERS[resolution] ?? 1);

    const canGenerate =
        state.kind !== "generating" &&
        prompt.trim().length > 0 &&
        credits >= creditCost;

    async function handleGenerate() {
        if (!canGenerate) return;

        const idempotencyKey = crypto.randomUUID();
        abortRef.current = new AbortController();
        setState({ kind: "generating" });

        try {
            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: prompt.trim(),
                    negativePrompt: negativePrompt.trim() || undefined,
                    model,
                    resolution,
                    aspectRatio,
                    projectUid,
                    idempotencyKey,
                }),
                signal: abortRef.current.signal,
            });

            const data = (await res.json()) as {
                imageUrl?: string;
                creditCost?: number;
                error?: string;
            };

            if (!res.ok) {
                setState({
                    kind: "error",
                    message: data.error ?? "Generation failed.",
                });
                return;
            }

            setCredits((c) => c - (data.creditCost ?? creditCost));
            setState({
                kind: "done",
                imageUrl: data.imageUrl ?? "",
                creditCost: data.creditCost ?? creditCost,
            });
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                setState({ kind: "idle" });
                return;
            }
            setState({
                kind: "error",
                message:
                    err instanceof Error
                        ? err.message
                        : "Generation failed. Please try again.",
            });
        }
    }

    function handleReset() {
        setState({ kind: "idle" });
    }

    function handleCancel() {
        abortRef.current?.abort();
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            {/* ─── Form panel ─────────────────────────────────── */}
            <div className="space-y-5">
                <div>
                    <div className="flex items-center gap-2">
                        <Link
                            href={`/projects/${projectUid}`}
                            className="text-sm text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                            aria-label="Back to project"
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
                        <h1 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                            Create
                        </h1>
                    </div>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                        Generating in{" "}
                        <Link
                            href={`/projects/${projectUid}`}
                            className="font-medium text-neutral-700 underline underline-offset-2 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-50"
                        >
                            {projectName}
                        </Link>
                    </p>
                </div>

                {/* Prompt */}
                <div>
                    <label
                        htmlFor="prompt"
                        className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                    >
                        Prompt
                    </label>
                    <textarea
                        id="prompt"
                        rows={4}
                        maxLength={10000}
                        placeholder="A cinematic wide shot of a lone astronaut walking through a neon-lit alley on Mars…"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={state.kind === "generating"}
                        className="w-full resize-y rounded-xl border border-neutral-200 bg-white px-4 py-3 text-[15px] text-neutral-950 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50 dark:placeholder:text-neutral-500 dark:focus-visible:ring-neutral-50 dark:focus-visible:ring-offset-neutral-950"
                    />
                </div>

                {/* Negative prompt (collapsible) */}
                {!showNegative ? (
                    <button
                        type="button"
                        onClick={() => setShowNegative(true)}
                        className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
                    >
                        + Add negative prompt
                    </button>
                ) : (
                    <div>
                        <label
                            htmlFor="negative"
                            className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                        >
                            Negative prompt
                        </label>
                        <textarea
                            id="negative"
                            rows={2}
                            maxLength={2000}
                            placeholder="blurry, low quality, distorted…"
                            value={negativePrompt}
                            onChange={(e) => setNegativePrompt(e.target.value)}
                            disabled={state.kind === "generating"}
                            className="w-full resize-y rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50 dark:placeholder:text-neutral-500 dark:focus-visible:ring-neutral-50 dark:focus-visible:ring-offset-neutral-950"
                        />
                    </div>
                )}

                {/* Options row */}
                <div className="grid grid-cols-3 gap-3">
                    {/* Model */}
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            Model
                        </label>
                        <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            disabled={state.kind === "generating" || models.length <= 1}
                            className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50"
                        >
                            {models.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Resolution */}
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            Resolution
                        </label>
                        <select
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value)}
                            disabled={state.kind === "generating"}
                            className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50"
                        >
                            {availableResolutions.map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                    {r === maxResolution && availableResolutions.length > 1
                                        ? " (max)"
                                        : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Aspect ratio */}
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            Aspect ratio
                        </label>
                        <select
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value)}
                            disabled={state.kind === "generating"}
                            className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50"
                        >
                            {ASPECT_RATIOS.map((ar) => (
                                <option key={ar.value} value={ar.value}>
                                    {ar.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Generate button + cost */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        disabled={!canGenerate}
                        onClick={handleGenerate}
                    >
                        {state.kind === "generating"
                            ? "Generating…"
                            : `Generate · ${creditCost} credit${creditCost !== 1 ? "s" : ""}`}
                    </Button>
                    {state.kind === "generating" && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancel}
                        >
                            Cancel
                        </Button>
                    )}
                </div>

                {/* Credits remaining */}
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {Intl.NumberFormat("en-US").format(credits)} credits
                    remaining · {planName} plan
                </p>
            </div>

            {/* ─── Canvas / result panel ──────────────────────── */}
            <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 lg:min-h-[500px]">
                {state.kind === "idle" && (
                    <div className="px-6 text-center">
                        <svg
                            width="40"
                            height="40"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mx-auto text-neutral-300 dark:text-neutral-700"
                            aria-hidden
                        >
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                        </svg>
                        <p className="mt-3 text-sm text-neutral-400 dark:text-neutral-600">
                            Your image will appear here
                        </p>
                    </div>
                )}

                {state.kind === "generating" && (
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700 dark:border-neutral-700 dark:border-t-neutral-300" />
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            Generating your image…
                        </p>
                    </div>
                )}

                {state.kind === "done" && (
                    <div className="relative h-full w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={state.imageUrl}
                            alt={prompt}
                            className="h-full w-full rounded-2xl object-contain"
                        />
                        <div className="absolute bottom-3 right-3 flex gap-2">
                            <a
                                href={state.imageUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black/60 px-3 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                Download
                            </a>
                            <button
                                type="button"
                                onClick={handleReset}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black/60 px-3 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                            >
                                New image
                            </button>
                        </div>
                    </div>
                )}

                {state.kind === "error" && (
                    <div className="flex flex-col items-center gap-3 px-6 text-center">
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-red-400"
                            aria-hidden
                        >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            {state.message}
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleReset}
                        >
                            Try again
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
