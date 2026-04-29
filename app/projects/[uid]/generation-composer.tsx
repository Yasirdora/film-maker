"use client";

/**
 * GenerationComposer — floating prompt input bar with image attachment.
 *
 * Pinned to the bottom of the workspace. Features:
 *   • Text input for the prompt
 *   • Image attachment via +button, drag-and-drop, or paste
 *   • Thumbnail preview row for attached images
 *   • Mode toggle (Image — Video disabled for v0)
 *   • Aspect ratio quick-toggle
 *   • Settings gear (opens ComposerSettings modal)
 *   • Generate button (submit)
 *
 * When reference images are attached, the API uses Gemini's editImage
 * with StyleReferenceImage instead of text-only generateImages.
 */

import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { toast } from "sonner";
import {
    ComposerSettings,
    type ComposerSettingsState,
    type Model,
} from "./composer-settings";
import { RESOLUTION_MULTIPLIERS, type Resolution } from "@/lib/constants";

// ─── Constants ──────────────────────────────────────────────────────────────

const LANDSCAPE_PORTRAIT_PAIRS: Record<string, string> = {
    "16:9": "9:16", "9:16": "16:9",
    "3:2": "2:3", "2:3": "3:2",
    "4:3": "3:4", "3:4": "4:3",
    "1:1": "1:1",
};

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_ATTACHED_IMAGES_PHOTO = 8;
const MAX_ATTACHED_IMAGES_VIDEO = 2;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── Types ──────────────────────────────────────────────────────────────────

interface AttachedImage {
    id: string;
    file: File;
    previewUrl: string;
}

export type ComposerMode = "image" | "video";

interface VideoModel {
    id: string;
    name: string;
    description: string;
    creditBase: number;
}

interface GenerationComposerProps {
    projectUid: string;
    models: Model[];
    videoModels: VideoModel[];
    availableResolutions: string[];
    planName: string;
    credits: number;
    onGenerationStart: (placeholder: {
        prompt: string;
        resolution: string;
        aspectRatio: string;
        sampleCount: number;
        kind: ComposerMode;
    }) => void;
    onGenerationComplete: (result: {
        uid: string;
        imageUrls: string[];
        creditCost: number;
        prompt: string;
        resolution: string;
        aspectRatio: string;
        kind: ComposerMode;
    }) => void;
    onGenerationError: (prompt: string, errorMessage: string) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function isValidImageFile(file: File): boolean {
    return (
        ACCEPTED_IMAGE_TYPES.includes(file.type) &&
        file.size <= MAX_IMAGE_SIZE_BYTES
    );
}

function extractImageFiles(dataTransfer: DataTransfer): File[] {
    const files: File[] = [];
    for (let i = 0; i < dataTransfer.files.length; i++) {
        const file = dataTransfer.files[i];
        if (isValidImageFile(file)) files.push(file);
    }
    return files;
}

/**
 * Fetches a remote image URL and wraps it in a `File` object so it can
 * flow through the same attachment pipeline as a file-picker upload.
 * Falls back to sensible defaults when the MIME type or extension is
 * missing so the Gemini API never receives a bare blob with no type.
 */
async function fetchUrlAsFile(
    imageUrl: string,
    fallbackName = "reference",
): Promise<File> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch reference image (${response.status})`);
    }
    const blob = await response.blob();
    const mimeType = ACCEPTED_IMAGE_TYPES.includes(blob.type)
        ? blob.type
        : "image/webp";
    const extension = mimeType.split("/")[1] ?? "webp";
    return new File([blob], `${fallbackName}.${extension}`, { type: mimeType });
}

// ─── Imperative handle ──────────────────────────────────────────────────────

/**
 * Subset of a past generation's parameters that the composer can restore
 * when the user asks to regenerate. Kept narrow so adding new fields
 * (model, sampleCount, etc.) later is a single-site change.
 */
export interface ComposerSnapshot {
    prompt: string;
    aspectRatio: string | null;
    kind: ComposerMode;
}

/**
 * Surface the composer exposes to its parent so gallery actions (reuse
 * prompt, use as reference, regenerate) can drive it without lifting all
 * of the composer's local state up. Every method is idempotent and safe
 * to call while a generation is in flight — the composer's internal
 * `canGenerate` guard remains the single source of truth.
 */
export interface GenerationComposerHandle {
    /** Replace the current prompt text (also focuses the input). */
    setPrompt: (prompt: string) => void;
    /** Fetch an image URL and attach it to the composer as a reference. */
    attachReferenceFromUrl: (imageUrl: string) => Promise<void>;
    /**
     * Atomically restore prompt + aspect ratio + mode from a past
     * generation. Uses `flushSync` so the composer's internal
     * `handleGenerate` closure sees the new values on the next `submit`
     * call without needing an rAF/timeout dance.
     */
    applySnapshot: (snapshot: ComposerSnapshot) => void;
    /** Submit the current composer state, same as clicking Generate. */
    submit: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const GenerationComposer = forwardRef<
    GenerationComposerHandle,
    GenerationComposerProps
>(function GenerationComposer(
    {
        projectUid,
        models,
        videoModels,
        availableResolutions,
        planName,
        credits,
        onGenerationStart,
        onGenerationComplete,
        onGenerationError,
    },
    ref,
) {
    const [prompt, setPrompt] = useState("");
    const [mode, setMode] = useState<ComposerMode>("image");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
    const [settings, setSettings] = useState<ComposerSettingsState>({
        model: models[0]?.id ?? "",
        aspectRatio: "16:9",
        sampleCount: 1,
    });
    const [videoModelId, setVideoModelId] = useState(videoModels[0]?.id ?? "");
    const abortRef = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounterRef = useRef(0);
    const controlsRowRef = useRef<HTMLDivElement>(null);

    const isVideo = mode === "video";
    const selectedModel = isVideo
        ? videoModels.find((m) => m.id === videoModelId)
        : models.find((m) => m.id === settings.model);
    const resolution = availableResolutions[availableResolutions.length - 1] ?? "1K";
    const creditCost = isVideo
        ? (selectedModel?.creditBase ?? 5) * settings.sampleCount
        : (selectedModel?.creditBase ?? 1) *
          (RESOLUTION_MULTIPLIERS[resolution as Resolution] ?? 1) *
          settings.sampleCount;

    const canGenerate =
        !isGenerating &&
        prompt.trim().length > 0 &&
        credits >= creditCost;

    // ─── Image attachment ───────────────────────────────────────────

    const maxImages = isVideo ? MAX_ATTACHED_IMAGES_VIDEO : MAX_ATTACHED_IMAGES_PHOTO;
    // In video mode, only the first 2 images are used (first/last frame).
    // The full set is preserved so switching back to photo restores them.
    const visibleImages = isVideo
        ? attachedImages.slice(0, MAX_ATTACHED_IMAGES_VIDEO)
        : attachedImages;

    const addImages = useCallback((files: File[]) => {
        setAttachedImages((prev) => {
            const limit = isVideo ? MAX_ATTACHED_IMAGES_VIDEO : MAX_ATTACHED_IMAGES_PHOTO;
            const remaining = limit - prev.length;
            if (remaining <= 0) return prev;

            const newImages = files.slice(0, remaining).map((file) => ({
                id: crypto.randomUUID(),
                file,
                previewUrl: URL.createObjectURL(file),
            }));

            return [...prev, ...newImages];
        });
    }, [isVideo]);

    function removeImage(id: string) {
        setAttachedImages((prev) => {
            const img = prev.find((i) => i.id === id);
            if (img) URL.revokeObjectURL(img.previewUrl);
            return prev.filter((i) => i.id !== id);
        });
    }

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []).filter(isValidImageFile);
        if (files.length > 0) addImages(files);
        e.target.value = ""; // Reset so the same file can be re-selected.
    }

    // ─── Drag and drop ──────────────────────────────────────────────

    function handleDragEnter(e: React.DragEvent) {
        e.preventDefault();
        dragCounterRef.current++;
        if (dragCounterRef.current === 1) setIsDragging(true);
    }

    function handleDragLeave(e: React.DragEvent) {
        e.preventDefault();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) setIsDragging(false);
    }

    function handleDragOver(e: React.DragEvent) {
        e.preventDefault();
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        dragCounterRef.current = 0;
        setIsDragging(false);
        const files = extractImageFiles(e.dataTransfer);
        if (files.length > 0) addImages(files);
    }

    // ─── Paste ──────────────────────────────────────────────────────

    function handlePaste(e: React.ClipboardEvent) {
        const items = e.clipboardData?.items;
        if (!items) return;

        const imageFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === "file" && ACCEPTED_IMAGE_TYPES.includes(item.type)) {
                const file = item.getAsFile();
                if (file && isValidImageFile(file)) imageFiles.push(file);
            }
        }
        if (imageFiles.length > 0) {
            e.preventDefault();
            addImages(imageFiles);
        }
    }

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
            sampleCount: settings.sampleCount,
            kind: mode,
        });

        if (isVideo) {
            // ─── Video generation ──────────────────────────────────

            // Convert the first attached image to base64 as a starting frame.
            let referenceImage: { data: string; mimeType: string } | undefined;
            if (visibleImages.length > 0) {
                try {
                    referenceImage = {
                        data: await fileToBase64(visibleImages[0].file),
                        mimeType: visibleImages[0].file.type,
                    };
                } catch {
                    onGenerationError(trimmedPrompt, "Failed to read attached image.");
                    setIsGenerating(false);
                    return;
                }
            }

            try {
                const res = await fetch("/api/generate-video", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        prompt: trimmedPrompt,
                        model: videoModelId,
                        aspectRatio: settings.aspectRatio,
                        durationSeconds: 8,
                        sampleCount: settings.sampleCount,
                        projectUid,
                        idempotencyKey,
                        referenceImage,
                    }),
                    signal: abortRef.current.signal,
                });

                const data = (await res.json()) as {
                    uid?: string;
                    videoUrl?: string;
                    videoUrls?: string[];
                    creditCost?: number;
                    error?: string;
                };

                if (!res.ok) {
                    const errorMessage = data.error ?? "Video generation failed.";
                    toast.error(errorMessage);
                    onGenerationError(trimmedPrompt, errorMessage);
                } else {
                    const urls = data.videoUrls ?? (data.videoUrl ? [data.videoUrl] : []);
                    onGenerationComplete({
                        uid: data.uid ?? "",
                        imageUrls: urls,
                        creditCost: data.creditCost ?? creditCost,
                        prompt: trimmedPrompt,
                        resolution,
                        aspectRatio: settings.aspectRatio,
                        kind: "video",
                    });
                    setPrompt("");
                    setAttachedImages((prev) => {
                        prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
                        return [];
                    });
                }
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") {
                    onGenerationError(trimmedPrompt, "Cancelled");
                } else {
                    onGenerationError(
                        trimmedPrompt,
                        err instanceof Error
                            ? err.message
                            : "Video generation failed. Please try again.",
                    );
                }
            } finally {
                setIsGenerating(false);
            }
            return;
        }

        // ─── Image generation ──────────────────────────────────────

        // Convert attached images to base64 for the API.
        let referenceImages: { data: string; mimeType: string }[] | undefined;
        if (visibleImages.length > 0) {
            try {
                referenceImages = await Promise.all(
                    visibleImages.map(async (img) => ({
                        data: await fileToBase64(img.file),
                        mimeType: img.file.type,
                    })),
                );
            } catch {
                onGenerationError(trimmedPrompt, "Failed to read attached images.");
                setIsGenerating(false);
                return;
            }
        }

        try {
            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: trimmedPrompt,
                    model: settings.model,
                    resolution,
                    aspectRatio: settings.aspectRatio,
                    sampleCount: settings.sampleCount,
                    projectUid,
                    idempotencyKey,
                    referenceImages,
                }),
                signal: abortRef.current.signal,
            });

            const data = (await res.json()) as {
                uid?: string;
                imageUrl?: string;
                imageUrls?: string[];
                creditCost?: number;
                error?: string;
            };

            if (!res.ok) {
                const errorMessage = data.error ?? "Generation failed.";
                toast.error(errorMessage);
                onGenerationError(trimmedPrompt, errorMessage);
            } else {
                const urls = data.imageUrls ?? (data.imageUrl ? [data.imageUrl] : []);
                onGenerationComplete({
                    uid: data.uid ?? "",
                    imageUrls: urls,
                    creditCost: data.creditCost ?? creditCost,
                    prompt: trimmedPrompt,
                    resolution,
                    aspectRatio: settings.aspectRatio,
                    kind: "image",
                });
                setPrompt("");
                setAttachedImages((prev) => {
                    prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
                    return [];
                });
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
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
        mode,
        isVideo,
        videoModelId,
        settings,
        resolution,
        creditCost,
        projectUid,
        attachedImages,
        onGenerationStart,
        onGenerationComplete,
        onGenerationError,
    ]);

    // ─── Imperative API for parent-driven actions ──────────────────

    useImperativeHandle(
        ref,
        () => ({
            setPrompt: (nextPrompt) => {
                setPrompt(nextPrompt);
                // Focus next paint so the caret sits at the end and the
                // user can edit immediately.
                requestAnimationFrame(() => inputRef.current?.focus());
            },
            attachReferenceFromUrl: async (imageUrl) => {
                const file = await fetchUrlAsFile(imageUrl);
                addImages([file]);
            },
            applySnapshot: (snapshot) => {
                // flushSync forces React to commit the state updates
                // synchronously — by the time this returns, the next
                // `submit()` call will see the new prompt, aspect ratio,
                // and mode in `handleGenerate`'s closure.
                flushSync(() => {
                    setPrompt(snapshot.prompt);
                    setMode(snapshot.kind);
                    if (snapshot.aspectRatio) {
                        setSettings((s) => ({
                            ...s,
                            aspectRatio: snapshot.aspectRatio!,
                        }));
                    }
                });
            },
            submit: () => {
                handleGenerate();
            },
        }),
        [addImages, handleGenerate],
    );

    // ─── Keyboard ───────────────────────────────────────────────────

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleGenerate();
        }
    }

    // ─── Ratio quick-toggle ─────────────────────────────────────────

    function handleRatioToggle() {
        const flipped = LANDSCAPE_PORTRAIT_PAIRS[settings.aspectRatio] ?? settings.aspectRatio;
        setSettings((s) => ({ ...s, aspectRatio: flipped }));
    }

    const isLandscape =
        settings.aspectRatio === "16:9" ||
        settings.aspectRatio === "3:2" ||
        settings.aspectRatio === "4:3";

    // ─── Render ─────────────────────────────────────────────────────

    return (
        <div className="relative shrink-0 px-3 pb-2 sm:px-0 sm:pb-8">
            <div className="mx-auto w-full sm:max-w-[600px]">
                <div
                    className={`relative flex flex-col rounded-2xl bg-[#1a1a1c]/90 px-2.5 py-2.5 ring-1 backdrop-blur-2xl sm:px-3 sm:py-2.5 ${
                        isDragging
                            ? "ring-white/20 outline-2 outline-dashed outline-white/20 outline-offset-[-2px]"
                            : "ring-white/[0.12] shadow-[0_-4px_24px_rgba(0,0,0,0.3)]"
                    }`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    {/* Drag overlay */}
                    {isDragging && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl">
                            <svg className="text-[#9ca3af]" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            <span className="text-[13px] font-medium text-[#9ca3af]">
                                Drop images here
                            </span>
                        </div>
                    )}

                    <div className={isDragging ? "pointer-events-none opacity-0" : ""}>
                        {/* Hidden file input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            multiple
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleFileSelect}
                            aria-hidden
                        />

                        {/* Thumbnail preview row */}
                        {visibleImages.length > 0 && (
                            <div className="group/row mb-3 flex items-center gap-3 overflow-x-auto pt-1 pr-1">
                                {visibleImages.map((img, index) => (
                                    <ImageThumbnail
                                        key={img.id}
                                        image={img}
                                        onRemove={() => removeImage(img.id)}
                                        showSwap={isVideo && visibleImages.length === 2 && index === 0}
                                        onSwap={() => {
                                            setAttachedImages((prev) => {
                                                const a = prev.indexOf(visibleImages[0]);
                                                const b = prev.indexOf(visibleImages[1]);
                                                if (a === -1 || b === -1) return prev;
                                                const next = [...prev];
                                                [next[a], next[b]] = [next[b], next[a]];
                                                return next;
                                            });
                                        }}
                                    />
                                ))}
                                {visibleImages.length < maxImages && (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-[#9ca3af] transition-colors hover:bg-white/[0.12] hover:text-white"
                                        aria-label="Add more images"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19" />
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Prompt input */}
                        <div className="flex items-center gap-2.5 py-1">
                            {visibleImages.length === 0 && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.07] text-[#9ca3af] transition-colors hover:bg-white/[0.12] hover:text-white"
                                    aria-label="Add image"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                </button>
                            )}
                            <input
                                ref={inputRef}
                                type="text"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePaste}
                                placeholder={
                                    isVideo && visibleImages.length > 0
                                        ? "Describe how to animate this image..."
                                        : isVideo
                                            ? "Describe your video scene..."
                                            : visibleImages.length > 0
                                                ? "Describe how to transform this image..."
                                                : "Describe your image..."
                                }
                                disabled={isGenerating}
                                className="min-w-0 flex-1 bg-transparent text-[16px] text-white placeholder-[#52525b] outline-none disabled:opacity-50"
                                autoComplete="off"
                            />
                        </div>

                        {/* Controls */}
                        <div ref={controlsRowRef} className="relative mt-2 flex items-center gap-1.5">
                            {/* Settings panel (rendered via portal so its
                                backdrop-blur isn't clipped by the composer
                                wrapper's own blur stacking context). */}
                            <ComposerSettings
                                models={models}
                                videoModels={videoModels}
                                mode={mode}
                                videoModelId={videoModelId}
                                onVideoModelChange={setVideoModelId}
                                settings={settings}
                                onSettingsChange={setSettings}
                                open={settingsOpen}
                                onClose={() => setSettingsOpen(false)}
                                triggerRef={controlsRowRef}
                            />

                            {/* Mode toggle */}
                            <div className="flex h-9 items-center rounded-[10px] bg-[#2a2a2d] p-[3px] shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setMode("image")}
                                    className={`flex h-full items-center gap-1.5 rounded-lg transition-all ${
                                        !isVideo ? "bg-[#1c1c1c] px-3" : "px-2.5"
                                    }`}
                                >
                                    <svg className="shrink-0 text-[#9ca3af]" width="18" height="18" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.17" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4.583 5.75a1.167 1.167 0 1 0 0-2.333 1.167 1.167 0 0 0 0 2.333Z" />
                                        <path d="M.583 2.917A2.333 2.333 0 0 1 2.917.583h7a2.333 2.333 0 0 1 2.333 2.334v7a2.333 2.333 0 0 1-2.333 2.333h-7A2.333 2.333 0 0 1 .583 9.917V2.917Z" />
                                        <path d="m2.917 12.25 4.958-4.958a1.167 1.167 0 0 1 1.633 0l2.742 2.625" />
                                    </svg>
                                    {!isVideo && (
                                        <span className="text-[13px] font-medium text-[#9ca3af]">Image</span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode("video")}
                                    className={`flex h-full items-center gap-1.5 rounded-lg transition-all ${
                                        isVideo ? "bg-[#1c1c1c] px-3" : "px-2.5"
                                    }`}
                                >
                                    <svg className="shrink-0 text-[#9ca3af]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="6 3 20 12 6 21 6 3" />
                                    </svg>
                                    {isVideo && (
                                        <span className="text-[13px] font-medium text-[#9ca3af]">Video</span>
                                    )}
                                </button>
                            </div>

                            {/* Ratio quick-toggle */}
                            <button
                                type="button"
                                onClick={handleRatioToggle}
                                className="flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-[10px] bg-[#2a2a2d] transition-colors hover:bg-[#353538] sm:w-auto sm:px-3"
                                aria-label={`Aspect ratio: ${settings.aspectRatio}`}
                            >
                                <svg
                                    className={`text-[#9ca3af] transition-transform duration-300 ${!isLandscape ? "rotate-90" : ""}`}
                                    width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                >
                                    <rect x="3" y="7" width="18" height="10" rx="2" />
                                </svg>
                                <span className="hidden text-[13px] font-medium text-white sm:inline">
                                    {settings.aspectRatio}
                                </span>
                            </button>

                            {/* Settings */}
                            <button
                                type="button"
                                onClick={() => setSettingsOpen((o) => !o)}
                                className={`group flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] outline-none transition-colors focus:outline-none focus-visible:outline-none ${
                                    settingsOpen
                                        ? "bg-[#3a3a3d]"
                                        : "bg-[#2a2a2d] hover:bg-[#353538]"
                                }`}
                                aria-label="Generation settings"
                            >
                                <svg className="text-gray-200 transition-colors group-hover:text-white" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="4" y1="21" x2="4" y2="14" />
                                    <line x1="4" y1="10" x2="4" y2="3" />
                                    <line x1="12" y1="21" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12" y2="3" />
                                    <line x1="20" y1="21" x2="20" y2="16" />
                                    <line x1="20" y1="12" x2="20" y2="3" />
                                    <line x1="1" y1="14" x2="7" y2="14" />
                                    <line x1="9" y1="8" x2="15" y2="8" />
                                    <line x1="17" y1="16" x2="23" y2="16" />
                                </svg>
                            </button>

                            {/* Spacer */}
                            <div className="flex-1" />

                            {/* Credit cost preview */}
                            {prompt.trim().length > 0 && (
                                <span className="text-xs tabular-nums text-[#52525b]">
                                    {creditCost} cr
                                </span>
                            )}

                            {/* Generate */}
                            <button
                                type="button"
                                onClick={handleGenerate}
                                disabled={!canGenerate}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-black transition-colors hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-white"
                                aria-label="Generate"
                            >
                                {isGenerating ? (
                                    <div className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-black/20 border-t-black" />
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="19" x2="12" y2="5" />
                                        <polyline points="5 12 12 5 19 12" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

// ─── Image thumbnail ──────────────────────────────────────────────────────

function ImageThumbnail({
    image,
    onRemove,
    showSwap,
    onSwap,
}: {
    image: AttachedImage;
    onRemove: () => void;
    showSwap: boolean;
    onSwap: () => void;
}) {
    const [previewOpen, setPreviewOpen] = useState(false);
    const [entered, setEntered] = useState(false);
    const [canHover, setCanHover] = useState(false);
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
    const thumbRef = useRef<HTMLDivElement>(null);
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Device capability — desktop uses hover, mobile uses tap.
    useEffect(() => {
        setCanHover(window.matchMedia("(hover: hover)").matches);
    }, []);

    // Trigger the fade+scale transition on the frame after the portal
    // mounts, so the CSS transition has a starting state to animate from.
    useLayoutEffect(() => {
        if (previewOpen && anchorRect) {
            const r = requestAnimationFrame(() => setEntered(true));
            return () => cancelAnimationFrame(r);
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on close
        setEntered(false);
    }, [previewOpen, anchorRect]);

    // Clear any pending hover-open timer on unmount.
    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        };
    }, []);

    // Measure the thumb's viewport position whenever the preview opens,
    // and re-measure on scroll/resize so the bubble stays pinned.
    useLayoutEffect(() => {
        if (!previewOpen || !thumbRef.current) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM measurement state
            setAnchorRect(null);
            return;
        }
        function measure() {
            if (thumbRef.current) {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM measurement state
                setAnchorRect(thumbRef.current.getBoundingClientRect());
            }
        }
        measure();
        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, true);
        return () => {
            window.removeEventListener("resize", measure);
            window.removeEventListener("scroll", measure, true);
        };
    }, [previewOpen]);

    // Mobile: dismiss on outside tap. setTimeout keeps the opening tap
    // from immediately closing it.
    useEffect(() => {
        if (!previewOpen || canHover) return;
        function handleClick(e: MouseEvent) {
            if (thumbRef.current?.contains(e.target as Node)) return;
            setPreviewOpen(false);
        }
        const t = setTimeout(() => {
            document.addEventListener("mousedown", handleClick);
        }, 0);
        return () => {
            clearTimeout(t);
            document.removeEventListener("mousedown", handleClick);
        };
    }, [previewOpen, canHover]);

    const previewHandlers = canHover
        ? {
              onMouseEnter: () => {
                  if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                  hoverTimerRef.current = setTimeout(() => {
                      setPreviewOpen(true);
                  }, 320);
              },
              onMouseLeave: () => {
                  if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                  hoverTimerRef.current = null;
                  setPreviewOpen(false);
              },
          }
        : {
              onClick: () => setPreviewOpen((o) => !o),
          };

    return (
        <div ref={thumbRef} className="group/thumb relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={image.previewUrl}
                alt=""
                className="h-[52px] w-[52px] cursor-pointer rounded-xl bg-white/[0.04] object-cover ring-1 ring-white/[0.08]"
                draggable={false}
                {...previewHandlers}
            />
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
                className="absolute -right-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-black/65 text-white/90 backdrop-blur-sm transition-all hover:bg-black/80 hover:text-white sm:opacity-0 sm:group-hover/thumb:opacity-100"
                aria-label="Remove image"
            >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>

            {previewOpen && anchorRect && typeof document !== "undefined" &&
                createPortal(
                    (() => {
                        const BUBBLE_MAX_W = 280;
                        const MARGIN = 12;
                        const ideal = anchorRect.left + anchorRect.width / 2;
                        const half = BUBBLE_MAX_W / 2;
                        const minCenter = half + MARGIN;
                        const maxCenter = window.innerWidth - half - MARGIN;
                        const left =
                            minCenter > maxCenter
                                ? window.innerWidth / 2
                                : Math.max(minCenter, Math.min(maxCenter, ideal));
                        return (
                            <div
                                style={{
                                    position: "fixed",
                                    bottom: window.innerHeight - anchorRect.top + 10,
                                    left,
                                    zIndex: 80,
                                    pointerEvents: "none",
                                    transformOrigin: "bottom center",
                                }}
                                className={`transition-[opacity,transform] duration-200 ease-out ${
                                    entered
                                        ? "translate-x-[-50%] translate-y-0 scale-100 opacity-100"
                                        : "translate-x-[-50%] translate-y-1 scale-95 opacity-0"
                                }`}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={image.previewUrl}
                                    alt=""
                                    className="max-h-[260px] max-w-[min(280px,calc(100vw-24px))] rounded-xl bg-[#0f0f11] object-contain shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_18px_-4px_rgba(0,0,0,0.5),0_24px_56px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.08]"
                                    draggable={false}
                                />
                            </div>
                        );
                    })(),
                    document.body,
                )}

            {/* Swap — floats over the gap between the two video frames */}
            {showSwap && (
                <button
                    type="button"
                    onClick={onSwap}
                    className="absolute top-1/2 left-[calc(100%+6px)] z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[8px] bg-black/55 text-white/80 ring-1 ring-white/[0.08] backdrop-blur-sm transition-all hover:bg-black/70 hover:text-white sm:opacity-0 sm:group-hover/row:opacity-100"
                    aria-label="Swap first and last frame"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 3L4 7l4 4" />
                        <path d="M4 7h16" />
                        <path d="M16 21l4-4-4-4" />
                        <path d="M20 17H4" />
                    </svg>
                </button>
            )}
        </div>
    );
}
