"use client";

/**
 * GenerationGallery — justified-rows photo grid (Flickr / 500px /
 * Adobe Stock / Google Photos style).
 *
 * Items are packed into horizontal rows, then each row is scaled so all
 * items in it share the same height and the row fills the container
 * edge-to-edge. Every image displays at its true aspect ratio, rows
 * justify flush-right, and chronological order is preserved strictly
 * left-to-right, top-to-bottom.
 *
 * Pending generations show a spinner, failed ones show the error.
 * Empty state encourages the user to start generating.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GenerationItem } from "./project-workspace";
import { usePopover } from "@/lib/use-popover";
import {
    DotsIcon,
    EditIcon,
    LayersIcon,
    RefreshIcon,
    DownloadIcon,
    LinkIcon,
    TrashIcon,
} from "@/components/icons/action-icons";

interface GalleryActions {
    onReusePrompt: (prompt: string) => void;
    onUseAsReference: (imageUrl: string) => void | Promise<void>;
    /**
     * Regenerate receives the full generation so the workspace can
     * restore the original aspect ratio and kind (image/video), not
     * just the prompt.
     */
    onRegenerate: (generation: GenerationItem) => void;
    onDelete: (uid: string) => void | Promise<void>;
}

interface GenerationGalleryProps extends GalleryActions {
    generations: GenerationItem[];
}

// ─── Layout tunables ────────────────────────────────────────────────────────

// Target height each row aims for before the justification scale is
// applied. Final row heights will land slightly above or below this
// depending on how tightly items pack into the available width. Values
// chosen to feel generous on desktop (~large thumbnails) and tap-
// friendly on phones.
const TARGET_ROW_HEIGHT_MOBILE = 160;
const TARGET_ROW_HEIGHT_TABLET = 200;
const TARGET_ROW_HEIGHT_DESKTOP = 240;
const GAP_MOBILE = 8;
const GAP_DESKTOP = 12;

// When the final row's natural width is far below the container width,
// leave it unstretched at target height instead of blowing items up
// into a second oversized hero row. Matches Flickr's approach.
const LAST_ROW_JUSTIFY_THRESHOLD = 0.5;

function computeTargetHeight(containerWidth: number): number {
    if (containerWidth < 480) return TARGET_ROW_HEIGHT_MOBILE;
    if (containerWidth < 768) return TARGET_ROW_HEIGHT_TABLET;
    return TARGET_ROW_HEIGHT_DESKTOP;
}

function computeGap(containerWidth: number): number {
    return containerWidth < 640 ? GAP_MOBILE : GAP_DESKTOP;
}

/** Convert "w:h" to the normalised width/height ratio; 1 for malformed input. */
function parseAspectRatio(value: string | null | undefined): number {
    if (!value) return 1;
    const [widthRaw, heightRaw] = value.split(":");
    const width = Number(widthRaw);
    const height = Number(heightRaw);
    if (!Number.isFinite(width) || !Number.isFinite(height) || height === 0) {
        return 1;
    }
    return width / height;
}

// ─── Justified-rows packer ──────────────────────────────────────────────────

interface PackedItem {
    item: GenerationItem;
    width: number;
    height: number;
}

interface PackedRow {
    items: PackedItem[];
    height: number;
}

/**
 * Linear-partition justified layout with **partition selection** — the
 * algorithm Flickr / 500px / Adobe Stock use.
 *
 * Pure greedy packing (stop as soon as you overflow) often breaks rows
 * too early, leaving the final scale factor far from 1 and producing
 * rows that are either unnaturally tall or short. Instead, at each
 * item we compare two candidate scales:
 *
 *   • `scaleWithout`  — scale needed to justify the current buffer as-is
 *   • `scaleWith`     — scale needed to justify the buffer with the new item
 *
 * and keep adding items as long as `scaleWith` is closer to 1 (in log
 * space, so over- and under-scaling are weighted symmetrically) than
 * `scaleWithout`. That rule is provably optimal for greedy row-based
 * justified layouts.
 *
 * Every finalized row is then scaled to fill the container exactly, so
 * rows justify flush-right. No artificial clamp — extreme aspect ratios
 * naturally shake out because the partition selection prefers breaks
 * that keep scale near 1.
 */
function packIntoJustifiedRows(
    items: GenerationItem[],
    containerWidth: number,
    targetHeight: number,
    gap: number,
): PackedRow[] {
    if (items.length === 0 || containerWidth <= 0) return [];

    const rows: PackedRow[] = [];
    let buffer: GenerationItem[] = [];
    let bufferNaturalWidth = 0;

    function availableForImages(itemCount: number): number {
        // Each adjacent pair is separated by one gap; the container
        // edges contribute no gap (the outer padding is handled by the
        // wrapper).
        return containerWidth - Math.max(0, itemCount - 1) * gap;
    }

    function logDeviation(scale: number): number {
        // Log space so 2× and 0.5× are treated as equally "far from 1".
        return Math.abs(Math.log(scale));
    }

    function buildRowScaledTo(
        rowItems: GenerationItem[],
        naturalWidth: number,
    ): PackedRow {
        const available = availableForImages(rowItems.length);
        const scale = available / naturalWidth;
        const height = targetHeight * scale;
        const packed: PackedItem[] = rowItems.map((item) => ({
            item,
            width: parseAspectRatio(item.aspectRatio) * targetHeight * scale,
            height,
        }));
        return { items: packed, height };
    }

    for (const item of items) {
        const naturalWidth = parseAspectRatio(item.aspectRatio) * targetHeight;

        if (buffer.length === 0) {
            buffer.push(item);
            bufferNaturalWidth = naturalWidth;
            continue;
        }

        const scaleWithout =
            availableForImages(buffer.length) / bufferNaturalWidth;
        const scaleWith =
            availableForImages(buffer.length + 1) /
            (bufferNaturalWidth + naturalWidth);

        if (logDeviation(scaleWithout) <= logDeviation(scaleWith)) {
            // Closing the row here keeps the scale closer to 1 than if
            // we'd packed one more item.
            rows.push(buildRowScaledTo(buffer, bufferNaturalWidth));
            buffer = [item];
            bufferNaturalWidth = naturalWidth;
        } else {
            buffer.push(item);
            bufferNaturalWidth += naturalWidth;
        }
    }

    // Final row: justify if it's reasonably full, otherwise left-align
    // at target height so a few trailing images don't stretch into a
    // disproportionate hero row.
    if (buffer.length > 0) {
        const available = availableForImages(buffer.length);
        const fill = bufferNaturalWidth / available;
        if (fill >= LAST_ROW_JUSTIFY_THRESHOLD) {
            rows.push(buildRowScaledTo(buffer, bufferNaturalWidth));
        } else {
            const packed: PackedItem[] = buffer.map((item) => ({
                item,
                width: parseAspectRatio(item.aspectRatio) * targetHeight,
                height: targetHeight,
            }));
            rows.push({ items: packed, height: targetHeight });
        }
    }

    return rows;
}

/**
 * Track the rendered width of the gallery container so the packing
 * algorithm has an accurate target. Uses ResizeObserver for precise
 * updates (handles sidebar collapses, zoom, device rotation, etc.).
 */
function useContainerWidth(
    ref: React.RefObject<HTMLDivElement | null>,
): number | null {
    const [width, setWidth] = useState<number | null>(null);
    useLayoutEffect(() => {
        const node = ref.current;
        if (!node) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM measurement state
        setWidth(node.clientWidth);
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM measurement state
                setWidth(entry.contentRect.width);
            }
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, [ref]);
    return width;
}

export function GenerationGallery({
    generations,
    onReusePrompt,
    onUseAsReference,
    onRegenerate,
    onDelete,
}: GenerationGalleryProps) {
    const actions: GalleryActions = {
        onReusePrompt,
        onUseAsReference,
        onRegenerate,
        onDelete,
    };
    if (generations.length === 0) {
        return (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04]">
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-ws-dim"
                        aria-hidden
                    >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                </div>
                <h2 className="mt-4 text-lg font-semibold">
                    No generations yet
                </h2>
                <p className="mt-2 max-w-sm text-sm text-ws-icon">
                    Type a prompt below and hit generate to create your first image.
                </p>
            </div>
        );
    }

    return <JustifiedRowsGrid generations={generations} actions={actions} />;
}

// ─── Justified rows grid ────────────────────────────────────────────────────

function JustifiedRowsGrid({
    generations,
    actions,
}: {
    generations: GenerationItem[];
    actions: GalleryActions;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const containerWidth = useContainerWidth(containerRef);

    const ready = containerWidth !== null && containerWidth > 0;
    const gap = ready ? computeGap(containerWidth) : 0;
    const targetHeight = ready ? computeTargetHeight(containerWidth) : 0;
    const rows = ready
        ? packIntoJustifiedRows(generations, containerWidth, targetHeight, gap)
        : [];

    return (
        <div
            ref={containerRef}
            className="mx-auto max-w-[85rem] px-4 pb-4 pt-4 sm:px-6 sm:pt-6"
        >
            {ready && (
                <div className="flex flex-col" style={{ gap }}>
                    {rows.map((row) => (
                        <div
                            key={row.items.map(({ item }) => item.uid).join("|")}
                            className="flex"
                            style={{ gap, height: row.height }}
                        >
                            {row.items.map(({ item, width, height }) => (
                                <div
                                    key={item.uid}
                                    className="shrink-0"
                                    style={{ width, height }}
                                >
                                    <GalleryCard
                                        generation={item}
                                        actions={actions}
                                    />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Gallery card ───────────────────────────────────────────────────────────

/**
 * Renders a single generation. The card is size-agnostic — it fills its
 * parent container — so the justified-rows layout above can give each
 * card an exact `width × height` without fighting an internal
 * aspect-ratio declaration.
 */
function GalleryCard({
    generation,
    actions,
}: {
    generation: GenerationItem;
    actions: GalleryActions;
}) {
    const { status, kind, prompt, resolution, aspectRatio } = generation;
    const isVideo = kind === "video";

    // Narrow once — variant-specific fields are only accessed after this.
    const imageUrl = status === "done" ? generation.imageUrl : null;
    const errorMessage = status === "failed" ? generation.errorMessage : null;

    // Media loading state — bridges the gap between "generation done"
    // and "browser has the pixels." Without this, the card shows a
    // near-transparent background while the browser fetches from R2.
    const [mediaLoaded, setMediaLoaded] = useState(false);
    const [mediaError, setMediaError] = useState(false);

    // Reset loading state when the URL changes (pending → done transition).
    useEffect(() => {
        setMediaLoaded(false);
        setMediaError(false);
    }, [imageUrl]);

    const showShimmer = status === "done" && !mediaLoaded && !mediaError;

    // Hover-to-play for videos
    const videoRef = useRef<HTMLVideoElement>(null);
    const handleMouseEnter = useCallback(() => {
        const v = videoRef.current;
        if (v && mediaLoaded) {
            v.currentTime = 0;
            v.play().catch(() => {});
        }
    }, [mediaLoaded]);
    const handleMouseLeave = useCallback(() => {
        const v = videoRef.current;
        if (v) {
            v.pause();
            v.currentTime = 0;
        }
    }, []);

    return (
        <div
            className="group relative h-full w-full overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] transition-all hover:ring-white/[0.12]"
            onMouseEnter={isVideo ? handleMouseEnter : undefined}
            onMouseLeave={isVideo ? handleMouseLeave : undefined}
        >
            <div className="relative h-full w-full">
                {status === "done" && isVideo ? (
                    <>
                        {showShimmer && <MediaShimmer />}
                        <video
                            ref={videoRef}
                            src={generation.imageUrl}
                            className={`h-full w-full object-cover transition-opacity duration-300 ${mediaLoaded ? "opacity-100" : "opacity-0"}`}
                            playsInline
                            muted
                            loop
                            preload="metadata"
                            onLoadedData={() => setMediaLoaded(true)}
                            onError={() => setMediaError(true)}
                        />
                    </>
                ) : status === "done" ? (
                    <>
                        {showShimmer && <MediaShimmer />}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={generation.imageUrl}
                            alt={prompt.slice(0, 100)}
                            className={`h-full w-full object-cover transition-opacity duration-300 ${mediaLoaded ? "opacity-100" : "opacity-0"}`}
                            loading="lazy"
                            onLoad={() => setMediaLoaded(true)}
                            onError={() => setMediaError(true)}
                        />
                    </>
                ) : status === "pending" ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
                        {isVideo && (
                            <span className="text-[11px] text-ws-dim">Generating video...</span>
                        )}
                    </div>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-[var(--destructive)]"
                            aria-hidden
                        >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span className="text-[11px] text-ws-icon">
                            {errorMessage}
                        </span>
                    </div>
                )}

                {/* Media load error — retry affordance */}
                {mediaError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setMediaError(false);
                                setMediaLoaded(false);
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 py-1.5 text-[12px] text-ws-icon transition-colors hover:bg-white/[0.14] hover:text-white"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 4 23 10 17 10" />
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                            </svg>
                            Retry
                        </button>
                    </div>
                )}

                {/* Action menu — visible on hover (desktop) or always on touch */}
                {status !== "pending" && (
                    <GalleryCardMenu
                        generation={generation}
                        actions={actions}
                    />
                )}

            </div>

            {/* Type + resolution badge */}
            {status === "done" && (
                <div className="absolute bottom-1.5 right-1.5 z-[2] flex items-center gap-1">
                    {isVideo && (
                        <div className="flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                            <svg className="text-white/80" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            <span className="text-[10px] font-medium text-white/80">Video</span>
                        </div>
                    )}
                    <div className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
                        {resolution}
                        {aspectRatio && aspectRatio !== "1:1"
                            ? ` · ${aspectRatio}`
                            : ""}
                    </div>
                </div>
            )}

            {/* Prompt preview — visible on hover (desktop) */}
            <div className="absolute inset-x-0 bottom-0 z-[1] translate-y-full bg-gradient-to-t from-black/80 via-black/60 to-transparent p-3 pt-8 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                <p className="line-clamp-2 text-[12px] leading-relaxed text-white/80">
                    {prompt}
                </p>
            </div>
        </div>
    );
}

// ─── Media shimmer ──────────────────────────────────────────────────────────

/**
 * Pulsing placeholder shown while the browser fetches the image/video
 * from R2. Fills the card and fades out when the media's `onLoad` fires.
 */
function MediaShimmer() {
    return (
        <div className="absolute inset-0 z-[1] animate-pulse bg-white/[0.06]" />
    );
}

// ─── Card action menu ───────────────────────────────────────────────────────

/**
 * Three-dot action menu overlaid on each gallery card. The popover is
 * rendered via a portal so the card's `overflow: hidden` doesn't clip
 * it, and anchored to the trigger button's measured viewport rect so it
 * tracks correctly across scrolling and window resize.
 */
function GalleryCardMenu({
    generation,
    actions,
}: {
    generation: GenerationItem;
    actions: GalleryActions;
}) {
    const [open, setOpen] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [copied, setCopied] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const closeMenu = useCallback(() => setOpen(false), []);

    const { anchorRect, menuRef } = usePopover({
        open,
        onClose: closeMenu,
        anchorRef: buttonRef,
    });

    // Reset transient inline states when the menu closes.
    useEffect(() => {
        if (!open) {
            setConfirmingDelete(false);
            setCopied(false);
        }
    }, [open]);

    const hasImage = generation.status === "done";

    // ── Keyboard navigation (WAI-ARIA menu pattern) ──────────────
    // Arrow keys move focus between enabled menu items; Home/End
    // jump to first/last; Escape closes the menu.
    const handleMenuKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            const menu = e.currentTarget;
            const items = Array.from(
                menu.querySelectorAll<HTMLButtonElement>(
                    '[role="menuitem"]:not(:disabled)',
                ),
            );
            if (items.length === 0) return;

            const currentIdx = items.indexOf(
                document.activeElement as HTMLButtonElement,
            );

            let nextIdx: number | null = null;

            switch (e.key) {
                case "ArrowDown":
                    nextIdx =
                        currentIdx < 0 ? 0 : (currentIdx + 1) % items.length;
                    break;
                case "ArrowUp":
                    nextIdx =
                        currentIdx < 0
                            ? items.length - 1
                            : (currentIdx - 1 + items.length) % items.length;
                    break;
                case "Home":
                    nextIdx = 0;
                    break;
                case "End":
                    nextIdx = items.length - 1;
                    break;
                case "Escape":
                    closeMenu();
                    buttonRef.current?.focus();
                    break;
                default:
                    return; // Don't preventDefault for unhandled keys.
            }

            if (nextIdx !== null) {
                e.preventDefault();
                items[nextIdx].focus();
            }
        },
        [closeMenu],
    );

    // Auto-focus the first enabled menu item when the menu opens.
    useEffect(() => {
        if (!open) return;
        // Defer to the next frame so the portal has mounted.
        const raf = requestAnimationFrame(() => {
            const el = menuRef.current;
            if (!el) return;
            const first = el.querySelector<HTMLButtonElement>(
                '[role="menuitem"]:not(:disabled)',
            );
            first?.focus();
        });
        return () => cancelAnimationFrame(raf);
    }, [open, menuRef]);

    function handleReusePrompt() {
        actions.onReusePrompt(generation.prompt);
        closeMenu();
    }

    async function handleUseAsReference() {
        if (generation.status !== "done") return;
        await actions.onUseAsReference(generation.imageUrl);
        closeMenu();
    }

    function handleRegenerate() {
        actions.onRegenerate(generation);
        closeMenu();
    }

    async function handleDownload() {
        if (generation.status !== "done" || downloading) return;
        setDownloading(true);
        try {
            const response = await fetch(generation.imageUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const extension = blob.type.split("/")[1] ?? "webp";
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `${generation.uid}.${extension}`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
            closeMenu();
        } catch (err) {
            console.error("[gallery] Download failed:", err);
        } finally {
            setDownloading(false);
        }
    }

    async function handleCopyLink() {
        if (generation.status !== "done") return;
        try {
            await navigator.clipboard.writeText(generation.imageUrl);
            setCopied(true);
            // Brief visible confirmation, then close.
            setTimeout(() => {
                closeMenu();
            }, 900);
        } catch (err) {
            console.error("[gallery] Clipboard write failed:", err);
        }
    }

    async function handleDelete() {
        if (!confirmingDelete) {
            setConfirmingDelete(true);
            return;
        }
        closeMenu();
        await actions.onDelete(generation.uid);
    }

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen((o) => !o);
                }}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Generation actions"
                className={`absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white/80 backdrop-blur-sm transition-all hover:bg-black/75 hover:text-white ${
                    open
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100"
                }`}
            >
                <DotsIcon size={14} />
            </button>

            {open && anchorRect && typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="menu"
                        onKeyDown={handleMenuKeyDown}
                        style={{
                            position: "fixed",
                            top: anchorRect.bottom + 6,
                            right: Math.max(
                                8,
                                window.innerWidth - anchorRect.right,
                            ),
                            zIndex: 80,
                        }}
                        className="min-w-[180px] overflow-hidden rounded-xl border border-white/[0.06] bg-[rgba(22,22,24,0.92)] shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_18px_-4px_rgba(0,0,0,0.5),0_24px_56px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl"
                    >
                        <ul className="flex flex-col p-1">
                            <MenuItem
                                label="Reuse prompt"
                                icon={<EditIcon />}
                                onClick={handleReusePrompt}
                            />
                            <MenuItem
                                label="Use as reference"
                                icon={<LayersIcon />}
                                onClick={handleUseAsReference}
                                disabled={!hasImage}
                            />
                            <MenuItem
                                label="Regenerate"
                                icon={<RefreshIcon />}
                                onClick={handleRegenerate}
                            />
                            <MenuDivider />
                            <MenuItem
                                label={
                                    downloading ? "Downloading…" : "Download"
                                }
                                icon={<DownloadIcon />}
                                onClick={handleDownload}
                                disabled={!hasImage || downloading}
                            />
                            <MenuItem
                                label={copied ? "Link copied" : "Copy link"}
                                icon={<LinkIcon />}
                                onClick={handleCopyLink}
                                disabled={!hasImage}
                            />
                            <MenuDivider />
                            <MenuItem
                                label={
                                    confirmingDelete
                                        ? "Confirm delete"
                                        : "Delete"
                                }
                                icon={<TrashIcon />}
                                onClick={handleDelete}
                                variant="destructive"
                            />
                        </ul>
                    </div>,
                    document.body,
                )}
        </>
    );
}

// ─── Menu primitives ────────────────────────────────────────────────────────

function MenuItem({
    label,
    icon,
    onClick,
    disabled = false,
    variant = "default",
}: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void | Promise<void>;
    disabled?: boolean;
    variant?: "default" | "destructive";
}) {
    const destructive = variant === "destructive";
    return (
        <li>
            <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={onClick}
                disabled={disabled}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    destructive
                        ? "text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                        : "text-white/85 hover:bg-white/[0.06] hover:text-white"
                }`}
            >
                <span className="shrink-0 text-ws-icon">{icon}</span>
                <span className="truncate">{label}</span>
            </button>
        </li>
    );
}

function MenuDivider() {
    return (
        <li aria-hidden className="my-1 h-px bg-white/[0.06]" />
    );
}

// Menu icons are now imported from @/components/icons/action-icons.
