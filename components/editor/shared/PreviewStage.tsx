"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Stage, Layer, Rect, Image as KImage, Text as KText, Transformer } from "react-konva";
import type Konva from "konva";
import { useEditor, selectVisibleClipsAt } from "@/lib/editor/store";
import { clock, useClockTime } from "@/lib/editor/clock";
import { leadingVideoClipId } from "@/lib/editor/mediaController";
import * as pool from "@/lib/editor/mediaPool";
import type { Clip, MediaAsset, MediaClip, TextClip } from "@/lib/editor/types";

type VisualMediaClip = MediaClip & { kind: "video" | "image" };

export default function PreviewStage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const canvas = useEditor((s) => s.canvas);
  const tracks = useEditor((s) => s.tracks);
  const clips = useEditor((s) => s.clips);
  const clipOrder = useEditor((s) => s.clipOrder);
  const assets = useEditor((s) => s.assets);
  const selectedClipId = useEditor((s) => s.selectedClipId);
  const setSelectedClip = useEditor((s) => s.setSelectedClip);
  const updateClipTransform = useEditor((s) => s.updateClipTransform);

  // Subscribe to project time so the visible-clip set updates per frame.
  const t = useClockTime();
  const visible = useMemo(
    () => selectVisibleClipsAt({ tracks, clips, clipOrder }, t),
    [tracks, clips, clipOrder, t],
  );

  // Resize observer for the outer container.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* `fitScale` maps canvas pixels to container pixels with the canvas's
     aspect-ratio constraint deciding which axis is limiting. Multiplied
     by `userZoom` to get the final on-screen scale — `userZoom === 1`
     means "at the size the editor naturally renders at", which is what
     users mentally call 100% zoom in this kind of UI. */
  const fitScale = useMemo(() => {
    if (!box.w || !box.h) return 0;
    return Math.min(box.w / canvas.width, box.h / canvas.height);
  }, [box, canvas.width, canvas.height]);

  /* User-controlled zoom multiplier on top of the fit-scale. Clamped to
     a sensible range — below 25% the canvas becomes a postage stamp,
     above 4× the user is past anything the source resolution supports. */
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 4;
  const [userZoom, setUserZoom] = useState(1);
  const effectiveScale = fitScale * userZoom;

  /* Auto-hiding zoom badge. `badgeVisible` flips to true on every zoom
     change and back to false after `BADGE_HIDE_DELAY_MS` of idle so the
     percentage doesn't overstay its welcome. Stored as state (not ref)
     so the surrounding div re-renders to flip the CSS opacity. */
  const BADGE_HIDE_DELAY_MS = 1200;
  const [badgeVisible, setBadgeVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBadge = useCallback(() => {
    setBadgeVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(
      () => setBadgeVisible(false),
      BADGE_HIDE_DELAY_MS,
    );
  }, []);

  /* Clean up any pending timer on unmount so it can't fire against an
     unmounted component. */
  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  /* Pinch-to-zoom on trackpads, Cmd/Ctrl + wheel on mice. Both come
     through as `WheelEvent` with `ctrlKey === true` — the browser sets
     it automatically for pinch gestures even when the physical Ctrl
     key isn't pressed. Plain wheel (no modifier, no pinch) bubbles up
     so any parent scroll behaviour still works. */
  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      /* `deltaY` is positive for "scroll down" / pinch-in (zoom out).
         An exponential factor keeps the zoom feel consistent at every
         scale — small steps shrink relative to the current zoom, not
         absolute pixels. The 0.01 constant approximates a 1% step per
         wheel notch on most trackpads. */
      setUserZoom((prev) => {
        const next = prev * Math.exp(-e.deltaY * 0.01);
        return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
      });
      showBadge();
    },
    [showBadge],
  );

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      className="flex-1 min-h-0 bg-[#101114] flex items-center justify-center overflow-hidden relative"
    >
      {effectiveScale > 0 && (
        <div
          style={{
            width: canvas.width * effectiveScale,
            height: canvas.height * effectiveScale,
          }}
          className="shadow-[0_0_0_1px_#252629,0_8px_32px_rgba(0,0,0,0.4)]"
        >
          <Stage
            width={canvas.width * effectiveScale}
            height={canvas.height * effectiveScale}
            scaleX={effectiveScale}
            scaleY={effectiveScale}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) setSelectedClip(null);
            }}
          >
            <Layer listening={false}>
              <Rect x={0} y={0} width={canvas.width} height={canvas.height} fill={canvas.background} />
            </Layer>
            <Layer>
              {visible.map((c) => (
                <ClipNode
                  key={c.id}
                  clip={c}
                  asset={c.kind === "text" ? null : assets[c.assetId]}
                  selected={selectedClipId === c.id}
                  onSelect={() => setSelectedClip(c.id)}
                  onTransform={(patch) => updateClipTransform(c.id, patch)}
                  projectTimeAtClipStart={c.start}
                  projectTime={t}
                />
              ))}
            </Layer>
          </Stage>
        </div>
      )}
      <ZoomBadge percent={Math.round(userZoom * 100)} visible={badgeVisible} />
      {/* Drives clock-from-video resync via rVFC on the leading video. */}
      <ClockAnchor visible={visible} />
    </div>
  );
}

/**
 * Auto-fading pill rendered top-right of the preview while the user
 * zooms. Receives the current zoom percent (relative to the fit-scale
 * baseline, i.e. 100% = how the preview normally renders) and a
 * visibility flag that the parent flips back to false after a brief
 * idle window. The fade is pure CSS so React doesn't re-render the
 * badge for the animation itself.
 */
function ZoomBadge({ percent, visible }: { percent: number; visible: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        padding: "4px 10px",
        borderRadius: 999,
        background: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        color: "rgba(255, 255, 255, 0.92)",
        fontSize: 11,
        fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: 0.2,
        opacity: visible ? 1 : 0,
        /* Fast fade in (so the badge feels responsive while you spin
           the wheel), slow fade out (so it "settles" rather than blinks
           off). */
        transition: visible
          ? "opacity 120ms ease-out"
          : "opacity 600ms ease-out",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {percent}%
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* ClipNode                                                                  */
/* ------------------------------------------------------------------------ */

function ClipNode({
  clip,
  asset,
  selected,
  onSelect,
  onTransform,
}: {
  clip: Clip;
  asset: MediaAsset | null | undefined;
  selected: boolean;
  onSelect: () => void;
  onTransform: (patch: Partial<NonNullable<Exclude<Clip, { kind: "audio" }>["transform"]>>) => void;
  projectTime: number;
  projectTimeAtClipStart: number;
}) {
  const nodeRef = useRef<Konva.Node | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);

  // Bind the transformer to the node when this clip is selected.
  useEffect(() => {
    if (selected && trRef.current && nodeRef.current) {
      trRef.current.nodes([nodeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selected]);

  if (clip.kind === "audio") return null;
  const tx = clip.transform;

  // Konva uses scaleX/Y signs for flips. We keep magnitude in `scale` and
  // overlay flip signs only at render time, so transforms commit cleanly.
  const sx = (tx.flipX ? -1 : 1) * tx.scale;
  const sy = (tx.flipY ? -1 : 1) * tx.scale;

  const commonProps: Konva.NodeConfig = {
    x: tx.x,
    y: tx.y,
    rotation: tx.rotation,
    opacity: tx.opacity,
    scaleX: sx,
    scaleY: sy,
    draggable: !selected ? true : true,
    onMouseDown: onSelect,
    onTap: onSelect,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      onTransform({ x: node.x(), y: node.y() });
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      // Recover the unsigned scale (Transformer may emit negative values
      // when the user crosses the origin during resize).
      const newScale = Math.max(0.05, Math.abs(node.scaleX()));
      onTransform({
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scale: newScale,
      });
      // Reset the visual scale so subsequent drags use our re-derived value.
      node.scaleX(sx > 0 ? newScale : -newScale);
      node.scaleY(sy > 0 ? newScale : -newScale);
    },
  };

  let visual: React.ReactNode = null;

  if (clip.kind === "text") {
    visual = <TextNode clip={clip} commonProps={commonProps} nodeRef={nodeRef} />;
  } else if (clip.kind === "video" || clip.kind === "image") {
    if (asset && (asset.kind === "video" || asset.kind === "image")) {
      visual = (
        <MediaNode
          clip={clip as VisualMediaClip}
          asset={asset}
          commonProps={commonProps}
          nodeRef={nodeRef}
        />
      );
    }
  }

  return (
    <>
      {visual}
      {selected && (
        <Transformer
          ref={(n) => {
            trRef.current = n;
          }}
          rotateEnabled
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
          anchorStroke="#ffcc00"
          anchorFill="#ffcc00"
          anchorSize={8}
          anchorCornerRadius={0}
          borderStroke="#ffcc00"
          borderStrokeWidth={1.5}
          rotateAnchorOffset={24}
          rotateAnchorCursor="grab"
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 16 || newBox.height < 16 ? oldBox : newBox
          }
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* TextNode                                                                  */
/* ------------------------------------------------------------------------ */

function TextNode({
  clip,
  commonProps,
  nodeRef,
}: {
  clip: TextClip;
  commonProps: Konva.NodeConfig;
  nodeRef: React.MutableRefObject<Konva.Node | null>;
}) {
  const s = clip.style;
  const measureRef = useRef<Konva.Text | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const node = measureRef.current;
    if (!node) return;
    setSize({ w: node.width(), h: node.height() });
  }, [s.text, s.fontFamily, s.fontSize, s.fontWeight, s.align]);

  return (
    <KText
      ref={(n) => {
        nodeRef.current = n;
        measureRef.current = n;
      }}
      {...commonProps}
      text={s.text}
      fontFamily={s.fontFamily}
      fontSize={s.fontSize}
      fontStyle={s.fontWeight >= 700 ? "bold" : "normal"}
      fill={s.color}
      align={s.align}
      offsetX={size.w / 2}
      offsetY={size.h / 2}
    />
  );
}

/* ------------------------------------------------------------------------ */
/* MediaNode — renders the pool's element via Konva.Image                    */
/* ------------------------------------------------------------------------ */

function MediaNode({
  clip,
  asset,
  commonProps,
  nodeRef,
}: {
  clip: VisualMediaClip;
  asset: MediaAsset;
  commonProps: Konva.NodeConfig;
  nodeRef: React.MutableRefObject<Konva.Node | null>;
}) {
  // For images: load once, store as state so React triggers a render when
  // the bitmap is ready. (Was a ref + manual `tick` bump; state is simpler
  // and avoids reading a ref during render — which the React 19 hooks rule
  // forbids.)
  // For videos: ride the pool entry the MediaController already manages —
  // this guarantees we never accidentally instantiate two video elements
  // for the same clip.
  const [tick, setTick] = useState(0);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (asset.kind !== "image") return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setLoadedImage(img);
    img.src = asset.url;
    /* Cleanup runs on asset change AND on unmount, so a stale image is
       cleared automatically when the user switches a clip's asset kind
       from image → video. */
    return () => { setLoadedImage(null); };
  }, [asset.kind, asset.url]);

  // Video asset: ensure pool entry exists (may already be pre-loaded by
  // the MediaController) and start the frame-repaint loop.
  //
  // KEY: we acquire the entry eagerly during render (not only in the
  // effect) so the very first paint already has a video element with a
  // decoded frame — the pre-buffer seek guarantees this. The effect then
  // starts the ongoing rVFC loop for subsequent frames.
  const videoEntry =
    asset.kind === "video"
      ? pool.acquire(clip.id, "video", asset.url)
      : null;

  useEffect(() => {
    if (!videoEntry) return;
    const v = videoEntry.el as HTMLVideoElement;

    let cancelled = false;
    let cbId = 0;
    const supportsRVFC = typeof (v as unknown as { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback === "function";
    type RVFC = (cb: (now: number, meta: VideoFrameCallbackMetadata) => void) => number;
    const rvfc = (v as unknown as { requestVideoFrameCallback?: RVFC }).requestVideoFrameCallback;
    const cancelRvfc = (v as unknown as { cancelVideoFrameCallback?: (id: number) => void }).cancelVideoFrameCallback;

    function loop() {
      if (cancelled) return;
      setTick((n) => (n + 1) | 0);
      // The image prop reference never changes, so react-konva won't detect a
      // diff and won't repaint. Force the layer to flush the new video frame.
      nodeRef.current?.getLayer()?.batchDraw();
      if (supportsRVFC && rvfc) {
        cbId = rvfc.call(v, loop);
      } else {
        cbId = requestAnimationFrame(loop);
      }
    }

    // Kick one immediate batchDraw so the pre-buffered frame shows on the
    // very first paint — no 1-frame black flash at cut points.
    requestAnimationFrame(() => {
      if (cancelled) return;
      nodeRef.current?.getLayer()?.batchDraw();
    });

    loop();
    return () => {
      cancelled = true;
      if (supportsRVFC && cancelRvfc) {
        try {
          cancelRvfc.call(v, cbId);
        } catch {
          /* ignore */
        }
      } else {
        cancelAnimationFrame(cbId);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.kind, asset.url, clip.id]);

  const el =
    asset.kind === "image"
      ? loadedImage
      : videoEntry
        ? (videoEntry.el as HTMLVideoElement)
        : undefined;

  if (!el) return null;
  const w = asset.kind === "image" ? (el as HTMLImageElement).naturalWidth : (el as HTMLVideoElement).videoWidth;
  const h = asset.kind === "image" ? (el as HTMLImageElement).naturalHeight : (el as HTMLVideoElement).videoHeight;
  if (!w || !h) return null;

  return (
    <KImage
      ref={(n) => {
        nodeRef.current = n;
      }}
      // Force re-evaluation on each decoded frame.
      key={tick === -1 ? "x" : undefined}
      image={el as CanvasImageSource}
      width={w}
      height={h}
      offsetX={w / 2}
      offsetY={h / 2}
      {...commonProps}
    />
  );
}

/* ------------------------------------------------------------------------ */
/* ClockAnchor — resyncs the master clock to the leading video's actual      */
/* decoded frame time, eliminating wall-clock vs. video drift.               */
/* ------------------------------------------------------------------------ */

function ClockAnchor({ visible }: { visible: Clip[] }) {
  const tracks = useEditor((s) => s.tracks);
  const clips = useEditor((s) => s.clips);
  const clipOrder = useEditor((s) => s.clipOrder);
  const tNow = useClockTime();

  const leadId = useMemo(
    () => leadingVideoClipId({ assets: {} as never, clips, clipOrder, tracks }, tNow),
    [clips, clipOrder, tracks, tNow],
  );

  const onAnchor = useCallback(() => {
    if (!leadId) return;
    const entry = pool.get(leadId);
    const c = clips[leadId];
    if (!entry || !c) return;
    const speed = c.speed || 1;
    // Map element-local time → project-time.
    const projectT = c.start + (entry.el.currentTime - c.inPoint) / speed;
    clock.syncTo(projectT);
  }, [leadId, clips]);

  useEffect(() => {
    if (!leadId) return;
    const entry = pool.get(leadId);
    const v = entry?.el as HTMLVideoElement | undefined;
    if (!v) return;
    type RVFC = (cb: (now: number, meta: VideoFrameCallbackMetadata) => void) => number;
    const rvfc = (v as unknown as { requestVideoFrameCallback?: RVFC }).requestVideoFrameCallback;
    if (typeof rvfc !== "function") return;
    let stop = false;
    let id = 0;
    const loop = () => {
      if (stop) return;
      onAnchor();
      id = rvfc.call(v, loop);
    };
    id = rvfc.call(v, loop);
    const cancelRvfc = (v as unknown as { cancelVideoFrameCallback?: (id: number) => void }).cancelVideoFrameCallback;
    return () => {
      stop = true;
      try {
        cancelRvfc?.call(v, id);
      } catch {
        /* ignore */
      }
    };
  }, [leadId, onAnchor]);

  // The component renders nothing visible.
  void visible;
  return null;
}
