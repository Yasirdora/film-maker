"use client";

/**
 * VariantTray — the per-shot image manager.
 *
 * Opens from a click on the selected image (or the "+N" badge when a
 * shot has alternates). Loads the full list lazily — the board-list
 * query only carries the selected variant.
 *
 * Layout:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ Variants                                          [×]       │
 *   │                                                              │
 *   │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                              │
 *   │ │ sel │ │     │ │     │ │  +  │                              │
 *   │ └─────┘ └─────┘ └─────┘ └─────┘                              │
 *   │                                                              │
 *   │ [Upload another]                                             │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Built on Radix Dialog so it traps focus + closes on Escape + has the
 * proper a11y story out of the box. Sizes itself to the content so it
 * doesn't dominate the screen on shots with one or two variants.
 */

import { useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Check, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { getImageUrl } from "@/lib/image-url";
import type { ShotImage } from "@/lib/storyboards";

import { useStoryboard } from "./workspace-context";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shotUid: string;
    shotLabel: string;
}

export function VariantTray({ open, onOpenChange, shotUid, shotLabel }: Props) {
    const selectShotImage = useStoryboard((s) => s.selectShotImage);
    const deleteShotImage = useStoryboard((s) => s.deleteShotImage);
    const uploadShotImage = useStoryboard((s) => s.uploadShotImage);

    const [images, setImages] = useState<ShotImage[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busyAction, setBusyAction] = useState<{
        kind: "select" | "delete";
        uid: string;
    } | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Load when the tray opens; reset state when it closes so the next
    // open starts fresh (covers the case where the underlying images
    // changed via another tab).
    useEffect(() => {
        if (!open) {
            setImages(null);
            setError(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(
                    `/api/storyboards/shots/${shotUid}/images`,
                );
                if (!res.ok) throw new Error(`Load failed (${res.status})`);
                const data = (await res.json()) as { images: ShotImage[] };
                if (!cancelled) setImages(data.images);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Load failed");
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, shotUid]);

    async function handleSelect(image: ShotImage) {
        if (image.isSelected) return;
        setBusyAction({ kind: "select", uid: image.uid });
        try {
            await selectShotImage(image);
            // Reflect the new selection in the tray's local state too.
            setImages((cur) =>
                cur
                    ? cur.map((i) => ({
                          ...i,
                          isSelected: i.uid === image.uid,
                      }))
                    : cur,
            );
        } finally {
            setBusyAction(null);
        }
    }

    async function handleDelete(image: ShotImage) {
        setBusyAction({ kind: "delete", uid: image.uid });
        try {
            await deleteShotImage(image);
            setImages((cur) => (cur ? cur.filter((i) => i.uid !== image.uid) : cur));
        } finally {
            setBusyAction(null);
        }
    }

    async function handleUpload(file: File) {
        setUploading(true);
        try {
            const created = await uploadShotImage(shotUid, file);
            if (created) {
                setImages((cur) => (cur ? [created, ...cur] : [created]));
            }
        } finally {
            setUploading(false);
        }
    }

    function onFiles(files: FileList | null) {
        if (!files) return;
        for (const file of Array.from(files)) {
            void handleUpload(file);
        }
    }

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-md" />
                <DialogPrimitive.Content
                    className="fixed left-1/2 top-1/2 z-[81] w-[calc(100%-32px)] max-w-[680px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/[0.08] bg-[rgba(22,22,24,0.96)] shadow-[0_24px_48px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] outline-none backdrop-blur-[40px] backdrop-saturate-150"
                >
                    <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
                        <div>
                            <DialogPrimitive.Title className="text-[14px] font-semibold text-white">
                                Variants
                            </DialogPrimitive.Title>
                            <DialogPrimitive.Description className="text-[12px] text-ws-icon">
                                {shotLabel}
                            </DialogPrimitive.Description>
                        </div>
                        <DialogPrimitive.Close
                            aria-label="Close variants"
                            className="rounded-md p-1 text-ws-icon transition-colors hover:bg-white/[0.06] hover:text-white"
                        >
                            <X className="h-4 w-4" />
                        </DialogPrimitive.Close>
                    </header>

                    <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
                        {error ? (
                            <p className="text-[13px] text-[#ff6b62]">{error}</p>
                        ) : !images ? (
                            <p className="text-[13px] text-ws-icon">Loading…</p>
                        ) : images.length === 0 ? (
                            <p className="text-[13px] text-ws-icon">
                                No variants yet. Upload an image to get started.
                            </p>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {images.map((image) => (
                                    <VariantTile
                                        key={image.uid}
                                        image={image}
                                        busy={
                                            busyAction?.uid === image.uid
                                                ? busyAction.kind
                                                : null
                                        }
                                        onSelect={() => handleSelect(image)}
                                        onDelete={() => handleDelete(image)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <footer className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3">
                        <span className="text-[12px] text-ws-dim">
                            JPG, PNG, WebP — converted to WebP on upload.
                        </span>
                        <button
                            type="button"
                            disabled={uploading}
                            onClick={() => fileRef.current?.click()}
                            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-[13px] font-semibold text-black transition-opacity hover:bg-white/90 disabled:cursor-progress disabled:opacity-60"
                        >
                            <Upload className="h-4 w-4" />
                            {uploading ? "Uploading…" : "Upload another"}
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            multiple
                            hidden
                            onChange={(e) => {
                                onFiles(e.currentTarget.files);
                                e.currentTarget.value = "";
                            }}
                        />
                    </footer>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

// ─── Tile ──────────────────────────────────────────────────────────────────

function VariantTile({
    image,
    busy,
    onSelect,
    onDelete,
}: {
    image: ShotImage;
    busy: "select" | "delete" | null;
    onSelect: () => void;
    onDelete: () => void;
}) {
    return (
        <div
            className={`group relative overflow-hidden rounded-lg border ${
                image.isSelected
                    ? "border-white/40 ring-1 ring-white/30"
                    : "border-white/10"
            }`}
        >
            <button
                type="button"
                onClick={onSelect}
                disabled={image.isSelected || busy !== null}
                aria-label={image.isSelected ? "Selected" : "Set as selected"}
                className="block aspect-video w-full bg-black/40"
            >
                {/* eslint-disable-next-line @next/next/no-img-element -- R2 image, no <Image /> loader for storyboards yet */}
                <img
                    src={getImageUrl(image.r2Key)}
                    alt=""
                    width={image.width}
                    height={image.height}
                    className="h-full w-full object-cover"
                    loading="lazy"
                />
            </button>

            {image.isSelected && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                    <Check className="h-3 w-3" />
                    Selected
                </span>
            )}

            {!image.isSelected && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        try {
                            onDelete();
                        } catch (err) {
                            toast.error(
                                err instanceof Error ? err.message : "Delete failed",
                            );
                        }
                    }}
                    disabled={busy !== null}
                    aria-label="Delete variant"
                    className="absolute right-2 top-2 rounded-md bg-black/60 p-1 text-white/85 opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}
