"use client";

/**
 * GenerationComposer — floating prompt input bar with image attachment.
 *
 * Pinned to the bottom of the workspace. Owns:
 *   • Text input for the prompt
 *   • Image attachment via +button, drag-and-drop, or paste
 *   • Thumbnail preview row (rendered by `ImageThumbnail`)
 *   • Mode toggle (Image / Video)
 *   • Aspect ratio quick-toggle
 *   • Settings gear (opens `ComposerSettings` modal)
 *   • Generate button (submit)
 *
 * Delegates the entire fetch → parse → poll → error pipeline to
 * `useGenerationSubmit`, which parameterises the image/video
 * differences (endpoint, body shape, reference encoding, poll budget,
 * URL key normalisation) behind a single `submit()` call.
 *
 * When reference images are attached, the API uses Gemini's editImage
 * with StyleReferenceImage instead of text-only generateImages.
 */

import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import { flushSync } from "react-dom";
import {
    ComposerSettings,
    type ComposerSettingsState,
} from "./composer-settings";
import { ImageThumbnail } from "./image-thumbnail";
import type { AttachedImage } from "./image-thumbnail";
import { useGenerationSubmit } from "./use-generation-submit";
import {
    RESOLUTION_MULTIPLIERS,
    type Resolution,
    type GenerationModel,
} from "@/lib/constants";

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

export type ComposerMode = "image" | "video";

interface GenerationComposerProps {
    projectUid: string;
    models: GenerationModel[];
    videoModels: GenerationModel[];
    availableResolutions: string[];
    planName: string;
    credits: number;
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

// ─── Helpers ────────────────────────────────────────────────────────────────

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
    const [isDragging, setIsDragging] = useState(false);
    const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
    const [settings, setSettings] = useState<ComposerSettingsState>({
        model: models[0]?.id ?? "",
        aspectRatio: "16:9",
        sampleCount: 1,
    });
    const [videoModelId, setVideoModelId] = useState(videoModels[0]?.id ?? "");
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounterRef = useRef(0);
    const controlsRowRef = useRef<HTMLDivElement>(null);

    const isVideo = mode === "video";
    const selectedModel = isVideo
        ? videoModels.find((m) => m.id === videoModelId)
        : models.find((m) => m.id === settings.model);
    const resolution = availableResolutions[0] ?? "1K";
    const creditCost = isVideo
        ? (selectedModel?.creditBase ?? 5) * settings.sampleCount
        : (selectedModel?.creditBase ?? 1) *
          (RESOLUTION_MULTIPLIERS[resolution as Resolution] ?? 1) *
          settings.sampleCount;

    // ─── Submit (hook before canGenerate so isGenerating is available) ──

    const clearComposer = useCallback(() => {
        setPrompt("");
        setAttachedImages((prev) => {
            prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
            return [];
        });
    }, []);

    const { submit, isGenerating } = useGenerationSubmit({
        onGenerationStart,
        onGenerationComplete,
        onGenerationError,
        onSuccess: clearComposer,
    });

    const canGenerate =
        !isGenerating &&
        prompt.trim().length > 0 &&
        credits >= creditCost;

    // ─── Image attachment ───────────────────────────────────────────

    // Revoke any lingering object URLs when the composer unmounts
    // (e.g. navigating away while images are still attached).
    useEffect(() => {
        return () => {
            // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup reads final snapshot
            setAttachedImages((prev) => {
                prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
                return prev;
            });
        };
    }, []);

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

    // ─── Generate handler ───────────────────────────────────────────

    const handleGenerate = useCallback(() => {
        if (!canGenerate) return;
        submit({
            prompt,
            mode,
            modelId: isVideo ? videoModelId : settings.model,
            resolution,
            aspectRatio: settings.aspectRatio,
            sampleCount: settings.sampleCount,
            creditCost,
            projectUid,
            visibleImages,
        });
    }, [
        canGenerate,
        submit,
        prompt,
        mode,
        isVideo,
        videoModelId,
        settings,
        resolution,
        creditCost,
        projectUid,
        visibleImages,
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
                    className={`relative flex flex-col rounded-2xl bg-ws-surface px-2.5 py-2.5 ring-1 sm:px-3 sm:py-2.5 ${
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
                            <svg className="text-ws-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            <span className="text-[13px] font-medium text-ws-icon">
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
                                        className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-ws-icon transition-colors hover:bg-white/[0.12] hover:text-white"
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
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.07] text-ws-icon transition-colors hover:bg-white/[0.12] hover:text-white"
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
                                className="min-w-0 flex-1 bg-transparent text-[16px] text-white placeholder-ws-dim outline-none disabled:opacity-50"
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
                            <div
                                role="radiogroup"
                                aria-label="Generation mode"
                                className="flex h-9 items-center rounded-[10px] bg-ws-control p-[3px] shrink-0"
                            >
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={!isVideo}
                                    onClick={() => setMode("image")}
                                    className={`flex h-full items-center gap-1.5 rounded-lg transition-all ${
                                        !isVideo ? "bg-[#1c1c1c] px-3" : "px-2.5"
                                    }`}
                                >
                                    <svg className="shrink-0 text-ws-icon" width="18" height="18" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.17" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4.583 5.75a1.167 1.167 0 1 0 0-2.333 1.167 1.167 0 0 0 0 2.333Z" />
                                        <path d="M.583 2.917A2.333 2.333 0 0 1 2.917.583h7a2.333 2.333 0 0 1 2.333 2.334v7a2.333 2.333 0 0 1-2.333 2.333h-7A2.333 2.333 0 0 1 .583 9.917V2.917Z" />
                                        <path d="m2.917 12.25 4.958-4.958a1.167 1.167 0 0 1 1.633 0l2.742 2.625" />
                                    </svg>
                                    {!isVideo && (
                                        <span className="text-[13px] font-medium text-ws-icon">Image</span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={isVideo}
                                    onClick={() => setMode("video")}
                                    className={`flex h-full items-center gap-1.5 rounded-lg transition-all ${
                                        isVideo ? "bg-[#1c1c1c] px-3" : "px-2.5"
                                    }`}
                                >
                                    <svg className="shrink-0 text-ws-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="6 3 20 12 6 21 6 3" />
                                    </svg>
                                    {isVideo && (
                                        <span className="text-[13px] font-medium text-ws-icon">Video</span>
                                    )}
                                </button>
                            </div>

                            {/* Ratio quick-toggle */}
                            <button
                                type="button"
                                onClick={handleRatioToggle}
                                className="flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-[10px] bg-ws-control transition-colors hover:bg-ws-control-hover sm:w-auto sm:px-3"
                                aria-label={`Aspect ratio: ${settings.aspectRatio}`}
                            >
                                <svg
                                    className={`text-ws-icon transition-transform duration-300 ${!isLandscape ? "rotate-90" : ""}`}
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
                                        ? "bg-ws-control-active"
                                        : "bg-ws-control hover:bg-ws-control-hover"
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
                                <span className="text-xs tabular-nums text-ws-dim">
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

