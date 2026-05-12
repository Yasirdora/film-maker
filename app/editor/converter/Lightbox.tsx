"use client";

import { useEffect, useRef, useState } from "react";
import { ScopedCategory, formatBytes } from "./config";

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
/** Below this drag distance a pointer-up is treated as a click, not a pan. */
const CLICK_TRAVEL_PX = 4;

export type LightboxItem = {
  id: string;
  url: string;
  filename: string;
  size: number;
  category: ScopedCategory;
  format: string;
};

export interface LightboxProps {
  items: LightboxItem[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}

/**
 * Modal previewer for converted media. Mounts above the rest of the page,
 * locks body scroll, traps `Esc` and arrow keys, and restores the previously
 * focused element on dismiss.
 */
export default function Lightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: LightboxProps) {
  const item = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Keyboard navigation: Esc to close, arrows to step.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && hasPrev) {
        onIndexChange(index - 1);
      } else if (e.key === "ArrowRight" && hasNext) {
        onIndexChange(index + 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasPrev, hasNext, index, onClose, onIndexChange]);

  // Lock body scroll + restore focus on unmount.
  useEffect(() => {
    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement | null) ?? null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the dialog so Esc/arrows are picked up reliably.
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, []);

  if (!item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${item.filename}`}
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        backgroundColor: "rgba(5, 5, 5, 0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <header
        className="flex items-center justify-between gap-3 sm:gap-4 px-3 sm:px-8 py-2.5 sm:py-4 flex-shrink-0"
        style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] sm:text-[15px] font-medium text-white truncate">
            {item.filename}
          </h3>
          <div className="text-[12px] sm:text-[13px] text-[#8e8e93] flex items-center gap-1.5 mt-0.5 truncate">
            <span>{formatBytes(item.size)}</span>
            <span className="text-[#3a3a3e]">·</span>
            <span>{item.format}</span>
            {items.length > 1 && (
              <>
                <span className="text-[#3a3a3e]">·</span>
                <span className="tabular-nums">
                  {index + 1} / {items.length}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          <a
            href={item.url}
            download={item.filename}
            aria-label={`Download ${item.filename}`}
            className="w-11 h-11 sm:w-9 sm:h-9 rounded-md flex items-center justify-center text-[#e4e4e7] hover:bg-white/[0.06] transition-colors"
          >
            <DownloadGlyph />
          </a>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="w-11 h-11 sm:w-9 sm:h-9 rounded-md flex items-center justify-center text-[#e4e4e7] hover:bg-white/[0.06] transition-colors"
          >
            <CloseGlyph />
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 relative">
        {item.category === "image" ? (
          <ImageStage key={item.id} src={item.url} alt={item.filename} />
        ) : item.category === "video" ? (
          <VideoStage src={item.url} />
        ) : (
          <AudioStage src={item.url} filename={item.filename} />
        )}
      </main>

      {items.length > 1 && (
        <footer
          className="flex items-center justify-center gap-3 sm:gap-4 px-4 py-3 sm:py-4 flex-shrink-0"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={() => hasPrev && onIndexChange(index - 1)}
            disabled={!hasPrev}
            aria-label="Previous"
            className="w-11 h-11 sm:w-10 sm:h-10 rounded-md flex items-center justify-center text-white bg-white/[0.08] hover:bg-white/[0.14] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronGlyph dir="left" />
          </button>
          <span className="text-[13px] text-[#8e8e93] tabular-nums min-w-[3rem] text-center">
            {index + 1} / {items.length}
          </span>
          <button
            type="button"
            onClick={() => hasNext && onIndexChange(index + 1)}
            disabled={!hasNext}
            aria-label="Next"
            className="w-11 h-11 sm:w-10 sm:h-10 rounded-md flex items-center justify-center text-white bg-white/[0.08] hover:bg-white/[0.14] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronGlyph dir="right" />
          </button>
        </footer>
      )}
    </div>
  );
}

// ─── Image stage with pan + zoom ─────────────────────────────────────────────

type Transform = { scale: number; x: number; y: number };

/**
 * The transform is stored in a ref and written to the image's `style.transform`
 * directly, avoiding a React render per pointer move. Without this the lightbox
 * jitters on every pan event.
 */
function ImageStage({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const transformRef = useRef<Transform>({ scale: 1, x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  // Pointer state for unified mouse/touch handling.
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const lastPinchDistanceRef = useRef<number | null>(null);
  const panOriginRef = useRef<{
    pointerX: number;
    pointerY: number;
    transformX: number;
    transformY: number;
  } | null>(null);

  /** Writes the transform to the DOM directly. Skips React re-renders. */
  function applyTransform(t: Transform) {
    transformRef.current = t;
    const img = imgRef.current;
    if (img) {
      img.style.transform = `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.scale})`;
    }
  }

  /** Computes a "fit to container" transform and applies it. */
  function applyFit(): boolean {
    const c = containerRef.current;
    const img = imgRef.current;
    if (!c || !img) return false;
    const cw = c.clientWidth;
    const ch = c.clientHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!cw || !ch || !iw || !ih) return false;
    // Fit, but never upscale above 1× on initial render.
    const scale = Math.min(cw / iw, ch / ih, 1);
    applyTransform({
      scale,
      x: (cw - iw * scale) / 2,
      y: (ch - ih * scale) / 2,
    });
    return true;
  }

  function onLoad() {
    // Apply fit synchronously inside the load handler so the very first paint
    // shows the image already centered — no flash at 1× / top-left.
    if (applyFit()) {
      setReady(true);
      return;
    }
    // Container size might not be settled yet (rare). Retry next frame.
    requestAnimationFrame(() => {
      if (applyFit()) setReady(true);
    });
  }

  // Refit on container resize. Skips the synthetic first-fire from
  // ResizeObserver — we already applied fit in onLoad.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let prevW = el.clientWidth;
    let prevH = el.clientHeight;
    const observer = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if ((w === prevW && h === prevH) || !imgRef.current?.naturalWidth) {
        return;
      }
      prevW = w;
      prevH = h;
      applyFit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function zoomBy(factor: number, anchor: { x: number; y: number }) {
    const prev = transformRef.current;
    const next = clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE);
    if (next === prev.scale) return;
    const real = next / prev.scale;
    applyTransform({
      scale: next,
      x: anchor.x - (anchor.x - prev.x) * real,
      y: anchor.y - (anchor.y - prev.y) * real,
    });
  }

  // Wheel zoom — non-passive so we can preventDefault page scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      // Smooth, deltaY-proportional zoom (works for trackpads and mice alike).
      const factor = Math.pow(0.998, e.deltaY);
      zoomBy(factor, {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // `zoomBy` reads only refs (no reactive deps) so binding once is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()];
      lastPinchDistanceRef.current = distance(p1, p2);
      // Cancel single-pointer pan when pinching starts.
      panOriginRef.current = null;
    } else if (pointersRef.current.size === 1) {
      const t = transformRef.current;
      panOriginRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        transformX: t.x,
        transformY: t.y,
      };
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (
      pointersRef.current.size === 2 &&
      lastPinchDistanceRef.current !== null
    ) {
      const [p1, p2] = [...pointersRef.current.values()];
      const newDistance = distance(p1, p2);
      const ratio = newDistance / lastPinchDistanceRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        zoomBy(ratio, {
          x: (p1.x + p2.x) / 2 - rect.left,
          y: (p1.y + p2.y) / 2 - rect.top,
        });
      }
      lastPinchDistanceRef.current = newDistance;
    } else if (
      pointersRef.current.size === 1 &&
      panOriginRef.current !== null
    ) {
      const origin = panOriginRef.current;
      const prev = transformRef.current;
      applyTransform({
        scale: prev.scale,
        x: origin.transformX + (e.clientX - origin.pointerX),
        y: origin.transformY + (e.clientY - origin.pointerY),
      });
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) lastPinchDistanceRef.current = null;
    if (pointersRef.current.size === 0) panOriginRef.current = null;
  }

  function onDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    const c = containerRef.current;
    const img = imgRef.current;
    if (!c || !img || !img.naturalWidth) return;
    const rect = c.getBoundingClientRect();
    const fitScale = Math.min(
      c.clientWidth / img.naturalWidth,
      c.clientHeight / img.naturalHeight,
      1,
    );
    const current = transformRef.current.scale;
    const atFit = Math.abs(current - fitScale) < 0.01;
    if (atFit) {
      // Currently fitted — zoom to 1:1, anchored at the cursor.
      zoomBy(1 / current, {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    } else {
      // Not fitted — return to fit.
      applyFit();
    }
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      className="absolute inset-0 overflow-hidden select-none cursor-grab active:cursor-grabbing"
      style={{ touchAction: "none" }}
    >
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center text-[#8e8e93] text-[14px]">
          Couldn&apos;t load preview.
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          onLoad={onLoad}
          onError={() => setError(true)}
          className={
            ready
              ? "transition-opacity duration-150"
              : "opacity-0"
          }
          style={{
            // Tailwind's preflight applies `max-width: 100%; height: auto;`
            // to all images, which clamps the natural dimensions and breaks
            // our transform math (we use naturalWidth/Height to compute fit).
            // Force the box to true natural size and let the transform handle
            // the rest.
            display: "block",
            maxWidth: "none",
            maxHeight: "none",
            width: "auto",
            height: "auto",
            transformOrigin: "0 0",
            willChange: "transform",
          }}
        />
      )}
    </div>
  );
}

// ─── Video stage ────────────────────────────────────────────────────────────

function VideoStage({ src }: { src: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-8">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        src={src}
        controls
        autoPlay
        playsInline
        className="max-w-full max-h-full rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
      />
    </div>
  );
}

// ─── Audio stage ────────────────────────────────────────────────────────────

function AudioStage({ src, filename }: { src: string; filename: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
      <div
        className="w-full max-w-md rounded-2xl p-5 sm:p-8"
        style={{
          backgroundColor: "#16161a",
          border: "1px solid #1f1f22",
        }}
      >
        <div
          className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl mb-4 sm:mb-5"
          style={{ backgroundColor: "#1c1c1f" }}
        >
          <AudioGlyph />
        </div>
        <div className="text-center text-[14px] text-white truncate mb-4 sm:mb-5">
          {filename}
        </div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio src={src} controls className="w-full" autoPlay />
      </div>
    </div>
  );
}

// ─── Glyphs ─────────────────────────────────────────────────────────────────

function CloseGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function DownloadGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ChevronGlyph({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      {dir === "left" ? (
        <polyline points="15 18 9 12 15 6" />
      ) : (
        <polyline points="9 18 15 12 9 6" />
      )}
    </svg>
  );
}

function AudioGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="#e4e4e7"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-9 h-9"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}
