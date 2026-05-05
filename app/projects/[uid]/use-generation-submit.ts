"use client";

/**
 * useGenerationSubmit — unified image/video generation submission.
 *
 * Encapsulates the full generation lifecycle:
 *   1. Encode attached images to base64
 *   2. POST to the generation endpoint
 *   3. Parse the response and normalise URL keys
 *   4. On success → call onComplete, clear composer
 *   5. On network failure → poll for recovery via idempotency key
 *   6. On abort → report cancellation
 *   7. On error → toast + call onError
 *
 * The image and video paths were previously duplicated (~100 lines
 * each, ~90% identical). This hook parameterises the differences:
 *   • API endpoint
 *   • Request body shape
 *   • Reference image encoding (single object vs array)
 *   • Poll timeout budget
 *   • URL key normalisation (videoUrl/videoUrls vs imageUrl/imageUrls)
 *
 * The hook returns `{ submit, isGenerating }`. The composer calls
 * `submit()` on Enter or button click.
 */

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { pollForCompletion } from "@/lib/poll-generation";
import { RESOLUTION_MULTIPLIERS, type Resolution } from "@/lib/constants";
import type { ComposerMode } from "./generation-composer";
import type { AttachedImage } from "./image-thumbnail";

// ─── Types ─────────────────────────────────────────────────────────────────

interface SubmitCallbacks {
    onGenerationStart: (placeholder: {
        generationKey: string;
        prompt: string;
        resolution: string;
        aspectRatio: string;
        sampleCount: number;
        kind: ComposerMode;
    }) => void;
    onGenerationComplete: (result: {
        generationKey: string;
        uid: string;
        imageUrls: string[];
        creditCost: number;
        prompt: string;
        resolution: string;
        aspectRatio: string;
        kind: ComposerMode;
    }) => void;
    onGenerationError: (generationKey: string, errorMessage: string) => void;
}

interface SubmitParams {
    prompt: string;
    mode: ComposerMode;
    modelId: string;
    resolution: string;
    aspectRatio: string;
    sampleCount: number;
    creditCost: number;
    projectUid: string;
    visibleImages: AttachedImage[];
}

interface UseGenerationSubmitOptions extends SubmitCallbacks {
    /** Called after a successful generation to reset the composer. */
    onSuccess: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Strip the data:image/...;base64, prefix — API expects raw base64.
            resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/** Normalise both singular and plural URL keys from the API response. */
function extractUrls(
    data: Record<string, unknown>,
    mode: ComposerMode,
): string[] {
    if (mode === "video") {
        const videoUrls = data.videoUrls as string[] | undefined;
        const videoUrl = data.videoUrl as string | undefined;
        return videoUrls ?? (videoUrl ? [videoUrl] : []);
    }
    const imageUrls = data.imageUrls as string[] | undefined;
    const imageUrl = data.imageUrl as string | undefined;
    return imageUrls ?? (imageUrl ? [imageUrl] : []);
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useGenerationSubmit({
    onGenerationStart,
    onGenerationComplete,
    onGenerationError,
    onSuccess,
}: UseGenerationSubmitOptions) {
    const [isGenerating, setIsGenerating] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const submit = useCallback(
        async (params: SubmitParams) => {
            const {
                prompt,
                mode,
                modelId,
                resolution,
                aspectRatio,
                sampleCount,
                creditCost,
                projectUid,
                visibleImages,
            } = params;

            const trimmedPrompt = prompt.trim();
            if (!trimmedPrompt) return;

            const idempotencyKey = crypto.randomUUID();
            abortRef.current = new AbortController();
            const { signal } = abortRef.current;

            const isVideo = mode === "video";

            setIsGenerating(true);
            onGenerationStart({
                generationKey: idempotencyKey,
                prompt: trimmedPrompt,
                resolution,
                aspectRatio,
                sampleCount,
                kind: mode,
            });

            // ── Encode reference images ───────────────────────────────
            let referencePayload: Record<string, unknown> | undefined;

            if (visibleImages.length > 0) {
                try {
                    if (isVideo) {
                        // Video: single reference image (first frame).
                        referencePayload = {
                            referenceImage: {
                                data: await fileToBase64(visibleImages[0].file),
                                mimeType: visibleImages[0].file.type,
                            },
                        };
                    } else {
                        // Image: array of reference images.
                        referencePayload = {
                            referenceImages: await Promise.all(
                                visibleImages.map(async (img) => ({
                                    data: await fileToBase64(img.file),
                                    mimeType: img.file.type,
                                })),
                            ),
                        };
                    }
                } catch {
                    const msg = isVideo
                        ? "Failed to read attached image."
                        : "Failed to read attached images.";
                    onGenerationError(idempotencyKey, msg);
                    setIsGenerating(false);
                    return;
                }
            }

            // ── Build request body ────────────────────────────────────
            const endpoint = isVideo ? "/api/generate-video" : "/api/generate";
            const maxPollAttempts = isVideo ? 24 : 12; // ~120s / ~60s
            const defaultErrorMsg = isVideo
                ? "Video generation failed."
                : "Generation failed.";

            const body: Record<string, unknown> = {
                prompt: trimmedPrompt,
                model: modelId,
                aspectRatio,
                sampleCount,
                projectUid,
                idempotencyKey,
                ...(isVideo ? { durationSeconds: 8 } : { resolution }),
                ...referencePayload,
            };

            // ── Fetch + error handling + poll recovery ────────────────
            try {
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                    signal,
                });

                const data = (await res.json()) as Record<string, unknown>;

                if (!res.ok) {
                    const errorMessage =
                        (data.error as string | undefined) ?? defaultErrorMsg;
                    toast.error(errorMessage);
                    onGenerationError(idempotencyKey, errorMessage);
                } else {
                    onGenerationComplete({
                        generationKey: idempotencyKey,
                        uid: (data.uid as string) ?? "",
                        imageUrls: extractUrls(data, mode),
                        creditCost:
                            (data.creditCost as number | undefined) ?? creditCost,
                        prompt: trimmedPrompt,
                        resolution,
                        aspectRatio,
                        kind: mode,
                    });
                    onSuccess();
                }
            } catch (err) {
                if (
                    err instanceof DOMException &&
                    err.name === "AbortError"
                ) {
                    onGenerationError(idempotencyKey, "Cancelled");
                } else {
                    // Connection lost — poll for recovery using the same
                    // idempotency key. The server's UNIQUE constraint
                    // prevents duplicate generation or double charges.
                    const recovered = await pollForCompletion({
                        endpoint,
                        body,
                        maxAttempts: maxPollAttempts,
                        intervalMs: 5_000,
                        signal,
                    });

                    if (recovered?.status === "done") {
                        const urls =
                            isVideo && recovered.videoUrls.length > 0
                                ? recovered.videoUrls
                                : recovered.imageUrls;
                        onGenerationComplete({
                            generationKey: idempotencyKey,
                            uid: recovered.uid,
                            imageUrls: urls,
                            creditCost: recovered.creditCost || creditCost,
                            prompt: trimmedPrompt,
                            resolution,
                            aspectRatio,
                            kind: mode,
                        });
                        onSuccess();
                    } else {
                        const errorMsg =
                            recovered?.error ??
                            (err instanceof Error
                                ? err.message
                                : `${defaultErrorMsg} Please try again.`);
                        toast.error(errorMsg);
                        onGenerationError(idempotencyKey, errorMsg);
                    }
                }
            } finally {
                setIsGenerating(false);
            }
        },
        [onGenerationStart, onGenerationComplete, onGenerationError, onSuccess],
    );

    return { submit, isGenerating };
}
