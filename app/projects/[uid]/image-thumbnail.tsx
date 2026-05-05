"use client";

/**
 * ImageThumbnail — attached-image preview with hover/tap enlarge.
 *
 * Displays a 52×52 thumbnail of an attached reference image. On
 * desktop, hovering for 320ms opens a larger preview bubble above
 * the thumbnail. On mobile (no hover capability), tapping toggles
 * the preview. The preview is portal-rendered with a fade+scale
 * entrance animation.
 *
 * Also renders the remove (×) button and, in video mode, a swap
 * button between the two frame thumbnails.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AttachedImage {
    id: string;
    file: File;
    previewUrl: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ImageThumbnail({
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
                                    className="max-h-[260px] max-w-[min(280px,calc(100vw-24px))] rounded-xl bg-ws-canvas object-contain shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_18px_-4px_rgba(0,0,0,0.5),0_24px_56px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.08]"
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
