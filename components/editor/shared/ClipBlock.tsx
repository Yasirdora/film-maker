"use client";

/**
 * ClipBlock — mode-agnostic timeline clip frame.
 *
 * Owns every interaction common to audio, video, image, and text clips:
 *   • selection ring + cursor name header
 *   • move-drag with snap + cross-track resolution (commits on release)
 *   • left/right trim drag (live, with snap)
 *   • fade-in/out drag handles + the diagonal preview line
 *   • cut-mode click-to-split
 *   • muted stripe + processing spinner overlays
 *   • right-click context menu hookup
 *
 * The body content (waveform, filmstrip, text preview, …) is supplied by the
 * caller through the `renderBody` render-prop. It receives the inner-content
 * dimensions and the resolved asset (when present), so each kind can pick the
 * right visualisation without leaking back into the frame.
 */

import {
  memo,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useEditor } from "@/lib/editor/store";
import { clock } from "@/lib/editor/clock";
import { collectSnapTargets, snapTime } from "@/lib/editor/snap";
import { hexToRgbTriplet } from "@/lib/editor/trackColors";
import type { Clip, EditorMode, MediaAsset } from "@/lib/editor/types";

const HEADER_H = 16;
const MUTED_RGB = "140, 140, 140";
/** Inner padding on each side of the clip body (matches `.padding: 2px` below). */
const BODY_INSET = 2;

export type ClipBlockVariant = "desktop" | "mobile";

export type ClipBodyContext = {
  clip: Clip;
  asset?: MediaAsset;
  /** Inner content width in CSS px (clip width minus body inset). */
  width: number;
  /** Inner content height in CSS px. 0 until the block is measured. */
  height: number;
  selected: boolean;
  /** Effective RGB triplet — e.g. "255, 200, 50". Lets bodies tint themselves
   *  with the same color the frame is using. */
  effectiveRgb: string;
};

export type ClipBlockProps = {
  clip: Clip;
  mode: EditorMode;
  zoom: number;
  locked: boolean;
  selected: boolean;
  variant: ClipBlockVariant;
  onSelect: () => void;
  /** Called once on drag release with the final start time and (optionally)
   *  the destination track id resolved from the cursor's Y position. */
  onMove: (start: number, trackId?: string) => void;
  onTrimStart: (t: number) => void;
  onTrimEnd: (t: number) => void;
  /** Resolves the destination track for a clip dragged to `clientY`. */
  resolveTrackAtY?: (clientY: number) => string | undefined;
  onDragEnd?: () => void;
  onContextMenu?: (x: number, y: number) => void;

  /** Override for the muted-visual state. Defaults to `clip.disabled`.
   *  Audio passes `clip.disabled && !isRecording` so a live take doesn't
   *  visually look bypassed even though it temporarily is. */
  isMuted?: boolean;
  /** Forced RGB triplet that overrides `clip.color` (but not the muted color).
   *  Audio uses this to tint the live recording clip red. */
  colorOverride?: string;
  /** When true, fade handles + diagonal line are not rendered. Use when an
   *  alternative overlay (e.g. volume envelope) occupies the same area. */
  hideFades?: boolean;
  /** Renders the kind-specific body content inside the clip frame. */
  renderBody?: (ctx: ClipBodyContext) => ReactNode;
};

export default memo(function ClipBlock({
  clip,
  mode,
  zoom,
  locked,
  selected,
  variant,
  onSelect,
  onMove,
  onTrimStart,
  onTrimEnd,
  resolveTrackAtY,
  onDragEnd,
  onContextMenu,
  isMuted: isMutedProp,
  colorOverride,
  hideFades,
  renderBody,
}: ClipBlockProps) {
  const asset = useEditor((s) =>
    "assetId" in clip ? s.assets[clip.assetId] : undefined,
  );
  const updateClip = useEditor((s) => s.updateClip);
  const setSnapIndicator = useEditor((s) => s.setSnapIndicator);
  const snapEnabled = useEditor((s) => s.snapEnabled);

  const blockRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fadeDragging, setFadeDragging] = useState(false);
  /* While a move-drag is in progress we render the clip as a ghost preview at
     the cursor's snapped position without committing the new start. `dy`
     follows the raw cursor delta so the ghost visibly crosses tracks. */
  const [moveGhost, setMoveGhost] = useState<{ dx: number; dy: number } | null>(null);

  useLayoutEffect(() => {
    const el = blockRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Color resolution order:
       1. Muted (disabled)         → flat gray, irrespective of clip.color.
       2. Caller-supplied override → e.g. red for a live recording take.
       3. Otherwise                → the clip's persistent color, seeded
                                     from the host track at creation. */
  const isMuted = isMutedProp ?? clip.disabled;
  const effectiveRgb = isMuted
    ? MUTED_RGB
    : colorOverride ?? hexToRgbTriplet(clip.color);

  const left = clip.start * zoom;
  const width = Math.max(8, clip.duration * zoom);
  const innerW = Math.max(1, width - BODY_INSET * 2);
  const innerH = Math.max(0, size.h - BODY_INSET * 2);

  const fadeIn = ("fadeIn" in clip ? clip.fadeIn : 0) ?? 0;
  const fadeOut = ("fadeOut" in clip ? clip.fadeOut : 0) ?? 0;
  const coordW = innerW;
  const fadeInPx = Math.min(fadeIn * zoom, coordW * 0.5);
  const fadeOutPx = Math.min(fadeOut * zoom, coordW * 0.5);

  /* Locked clips never visually look selected. */
  const effectiveSelected = locked ? false : selected;
  const isMobile = variant === "mobile";
  const showFadeUI = !isMobile && effectiveSelected && !hideFades;

  /* ── Drag gestures ─────────────────────────────────────────────────── */

  function startFadeDrag(e: React.MouseEvent, kind: "in" | "out") {
    if (locked) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const origIn = fadeIn;
    const origOut = fadeOut;
    const maxFade = clip.duration * 0.5;
    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      if (kind === "in") {
        const next = Math.max(0, Math.min(maxFade, origIn + dx));
        updateClip(clip.id, { fadeIn: next } as Partial<Clip>);
      } else {
        const next = Math.max(0, Math.min(maxFade, origOut - dx));
        updateClip(clip.id, { fadeOut: next } as Partial<Clip>);
      }
    };
    setFadeDragging(true);
    const up = () => {
      setFadeDragging(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function startDrag(e: React.MouseEvent, kind: "move" | "left" | "right") {
    if (locked) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    setDragging(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const origStart = clip.start;
    const origEnd = clip.start + clip.duration;
    /* Latest move target captured in closure so the up-handler can commit a
       single onMove with the final position. */
    let pendingMove: { start: number; trackId?: string } | null = null;

    /* Lock the page cursor for the duration of the drag — without this it
       flickers to whatever is under the pointer once the ghost gains
       `pointer-events: none`. */
    const prevBodyCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = kind === "move" ? "grabbing" : "ew-resize";
    document.body.style.userSelect = "none";

    const applySnap = (raw: number, alsoRightEdge = false): number => {
      if (!snapEnabled) {
        setSnapIndicator(null);
        return raw;
      }
      const { clips, clipOrder } = useEditor.getState();
      const targets = collectSnapTargets(clips, clipOrder, clip.id, clock.time());
      const startSnap = snapTime(raw, targets, zoom);
      if (!alsoRightEdge) {
        setSnapIndicator(startSnap.indicator);
        return startSnap.snapped;
      }
      const endSnap = snapTime(raw + clip.duration, targets, zoom);
      const startDelta =
        startSnap.indicator !== null ? Math.abs(startSnap.snapped - raw) : Infinity;
      const endDelta =
        endSnap.indicator !== null
          ? Math.abs(endSnap.snapped - (raw + clip.duration))
          : Infinity;
      if (startDelta === Infinity && endDelta === Infinity) {
        setSnapIndicator(null);
        return raw;
      }
      if (startDelta <= endDelta) {
        setSnapIndicator(startSnap.indicator);
        return startSnap.snapped;
      }
      setSnapIndicator(endSnap.indicator);
      return Math.max(0, endSnap.snapped - clip.duration);
    };

    const move = (ev: MouseEvent) => {
      const dt = (ev.clientX - startX) / zoom;
      if (kind === "move") {
        const raw = Math.max(0, origStart + dt);
        const finalStart = applySnap(raw, true);
        const trackId = resolveTrackAtY?.(ev.clientY);
        pendingMove = { start: finalStart, trackId };
        setMoveGhost({ dx: finalStart - origStart, dy: ev.clientY - startY });
      } else if (kind === "left") {
        onTrimStart(applySnap(origStart + dt));
      } else {
        onTrimEnd(applySnap(origEnd + dt));
      }
    };

    const up = () => {
      setSnapIndicator(null);
      setDragging(false);
      if (kind === "move" && pendingMove) {
        onMove(pendingMove.start, pendingMove.trackId);
      }
      setMoveGhost(null);
      document.body.style.cursor = prevBodyCursor;
      document.body.style.userSelect = prevUserSelect;
      onDragEnd?.();
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  /* ── Render ────────────────────────────────────────────────────────── */

  const pillHandle: CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 2,
    height: Math.min(28, Math.max(10, size.h - 14)),
    borderRadius: 2,
    background: "rgba(0,0,0,0.85)",
    cursor: "ew-resize",
    zIndex: 10,
    userSelect: "none",
    opacity: effectiveSelected ? 1 : 0,
    pointerEvents: effectiveSelected ? "auto" : "none",
    transition: "opacity 160ms ease",
  };

  return (
    <div
      ref={blockRef}
      className="absolute"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
        onContextMenu?.(e.clientX, e.clientY);
      }}
      style={{
        position: "absolute",
        left: left + (moveGhost ? moveGhost.dx * zoom : 0),
        width,
        top: 5,
        bottom: 5,
        opacity: moveGhost ? 0.5 : 1,
        pointerEvents: moveGhost ? "none" : undefined,
        zIndex: moveGhost ? 30 : undefined,
        transform: moveGhost
          ? `translateY(${moveGhost.dy}px)${dragging ? " scale(1.011)" : ""}`
          : dragging
          ? "scale(1.011)"
          : undefined,
        transition: "opacity 160ms ease, transform 90ms ease",
      }}
    >
      {/* Clip surface — overflow:hidden lives here, not on the wrapper */}
      <div
        onMouseDown={(e) => {
          if (mode === "cut") {
            e.stopPropagation();
            e.preventDefault();
            const rect = blockRef.current!.getBoundingClientRect();
            const dt = (e.clientX - rect.left) / zoom;
            useEditor.getState().splitClipAtTime(clip.id, clip.start + dt);
            return;
          }
          if (mode === "hand" || mode === "range") {
            // Bubble up so the timeline can pan or drag-select.
            return;
          }
          startDrag(e, "move");
        }}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 8,
          border: effectiveSelected ? "none" : `2px solid rgba(${effectiveRgb}, 0.8)`,
          background: effectiveSelected
            ? `rgba(${effectiveRgb}, 0.25)`
            : `rgba(${effectiveRgb}, 0.12)`,
          cursor: locked
            ? "not-allowed"
            : mode === "cut"
            ? "pointer"
            : dragging
            ? "grabbing"
            : "grab",
          padding: BODY_INSET,
          boxSizing: "border-box",
          display: "flex",
          overflow: "hidden",
          /* Drag elevation: shadow lift. The matching scale lives on the
             outer wrapper so fade handles scale with the block. */
          boxShadow: dragging
            ? "0 10px 28px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08) inset"
            : effectiveSelected
            ? "0 1px 0 rgba(255,255,255,0.08) inset, 0 -1px 0 rgba(0,0,0,0.4) inset"
            : "0 1px 0 rgba(255,255,255,0.04) inset, 0 -1px 0 rgba(0,0,0,0.2) inset",
          zIndex: dragging ? 20 : undefined,
          transition: "background 160ms ease, box-shadow 90ms ease",
        }}
      >
        {/* Left trim handle */}
        <div
          style={{ ...pillHandle, left: 1.5 }}
          onMouseDown={(e) => startDrag(e, "left")}
        />

        {/* Inner content area */}
        <div
          style={{
            flex: 1,
            borderRadius: 6,
            overflow: "hidden",
            background: "transparent",
            position: "relative",
          }}
        >
          {/* Disabled diagonal-stripe overlay */}
          {isMuted && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 3,
                pointerEvents: "none",
                background:
                  "repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(0,0,0,0.35) 4px,rgba(0,0,0,0.35) 6px)",
                borderRadius: 6,
              }}
            />
          )}

          {/* Processing spinner (e.g. FFmpeg) */}
          {clip.isProcessing && (
            <div
              aria-hidden="true"
              className="flex items-center justify-center"
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 4,
                background: "rgba(0,0,0,0.6)",
                borderRadius: 6,
              }}
            >
              <svg
                className="animate-spin text-white"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
          )}

          {/* Clip name — only visible when selected */}
          {effectiveSelected && (
            <div
              style={{
                position: "absolute",
                top: 3,
                left: 8,
                right: 8,
                height: HEADER_H,
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
                zIndex: 2,
                pointerEvents: "none",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {asset?.name ?? "(no asset)"}
            </div>
          )}

          {/* Body content (waveform, filmstrip, …) */}
          {renderBody && (
            <div style={{ position: "absolute", inset: 0 }}>
              {renderBody({
                clip,
                asset,
                width: innerW,
                height: innerH,
                selected: effectiveSelected,
                effectiveRgb,
              })}
            </div>
          )}

          {/* Fade preview line — diagonal from corner to fade edge */}
          {showFadeUI && size.h > 0 && (
            <svg
              width={coordW}
              height={size.h}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                zIndex: 5,
                pointerEvents: "none",
              }}
              aria-hidden="true"
            >
              {fadeInPx > 0.5 && (
                <line
                  x1={0}
                  y1={size.h}
                  x2={fadeInPx}
                  y2={1.5}
                  stroke="rgba(255,255,255,0.45)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              )}
              {fadeOutPx > 0.5 && (
                <line
                  x1={coordW - fadeOutPx}
                  y1={1.5}
                  x2={coordW}
                  y2={size.h}
                  stroke="rgba(255,255,255,0.45)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              )}
            </svg>
          )}
        </div>

        {/* Selection ring — flat-color expand to cover the body */}
        <div
          style={{
            position: "absolute",
            top: 2,
            bottom: 2,
            left: 5,
            right: 5,
            borderRadius: 6,
            pointerEvents: "none",
            zIndex: 6,
            boxShadow: "0 0 0 50px rgb(255, 69, 58)",
            opacity: effectiveSelected ? 1 : 0,
            transition: "opacity 160ms ease",
          }}
        />

        {/* Right trim handle */}
        <div
          style={{ ...pillHandle, right: 1.5 }}
          onMouseDown={(e) => startDrag(e, "right")}
        />
      </div>

      {/* Fade dots — outside the overflow:hidden surface, never clipped */}
      {showFadeUI && (
        <>
          <FadeDot
            position="in"
            offsetPx={BODY_INSET + fadeInPx}
            visible={fadeIn > 0}
            highlight={hovered || fadeDragging}
            onMouseDown={(e) => startFadeDrag(e, "in")}
          />
          <FadeDot
            position="out"
            offsetPx={BODY_INSET + fadeOutPx}
            visible={fadeOut > 0}
            highlight={hovered || fadeDragging}
            onMouseDown={(e) => startFadeDrag(e, "out")}
          />
        </>
      )}
    </div>
  );
});

function FadeDot({
  position,
  offsetPx,
  visible,
  highlight,
  onMouseDown,
}: {
  position: "in" | "out";
  offsetPx: number;
  visible: boolean;
  highlight: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  /* When the fade has nonzero duration we keep the dot mounted and shrink it
     while idle; otherwise we fade opacity. The two transitions are split so
     the dot animation tracks the right property. */
  return (
    <div
      className={
        visible
          ? "transition-transform duration-150"
          : "transition-opacity duration-150"
      }
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onMouseDown(e);
      }}
      style={{
        position: "absolute",
        top: 0,
        [position === "in" ? "left" : "right"]: offsetPx - 3.5,
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.9)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
        cursor: "ew-resize",
        zIndex: 20,
        ...(visible
          ? { transform: `scale(${highlight ? 1 : 0.5})` }
          : { opacity: highlight ? 1 : 0 }),
      }}
    />
  );
}
