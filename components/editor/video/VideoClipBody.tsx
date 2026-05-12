"use client";

/**
 * VideoClipBody — what gets rendered inside a video or image clip's body.
 *
 * Mirrors the audio side's <AudioClipBody>: composed inside <ClipBlock>
 * via its `renderBody` render-prop. Drives the lane filmstrip:
 *
 *   • Video clips → fetch a per-asset filmstrip (8 evenly-spaced frames,
 *     cached in lib/editor/filmstrip.ts), then render the frames that fall
 *     inside the clip's visible source-time window. Images outside the
 *     window are clipped by the parent's `overflow: hidden`.
 *   • Image clips → background-image with the asset's cached thumbnail.
 *   • Either kind, no thumbnail yet → a "loading…" placeholder so the
 *     clip body never reads as broken.
 *
 * Frame placement honours `clip.inPoint` and `clip.duration * clip.speed`
 * so trims and time stretches stay accurate; the wrapper is overflow-hidden
 * so frames spilling past the trim are masked, not deleted.
 */

import type { ClipBodyContext } from "@/components/editor/shared/ClipBlock";
import type { MediaClip } from "@/lib/editor/types";
import { useFilmstrip } from "@/lib/editor/filmstrip";

export default function VideoClipBody({ clip, asset, width, height }: ClipBodyContext) {
  if (clip.kind !== "video" && clip.kind !== "image") return null;
  if (height <= 0 || width <= 0) return null;

  if (clip.kind === "image") return <ImageBody asset={asset} />;

  /* `clip.kind === "video"` past the early returns above; the cast pins the
     narrowed type so the filmstrip body can read assetId/inPoint/etc. */
  return (
    <VideoFilmstripBody
      clip={clip as MediaClip & { kind: "video" }}
      asset={asset}
      width={width}
      height={height}
    />
  );
}

/* ── Video ───────────────────────────────────────────────────────────── */

function VideoFilmstripBody({
  clip,
  asset,
  width,
  height,
}: {
  clip: MediaClip & { kind: "video" };
  asset: ClipBodyContext["asset"];
  width: number;
  height: number;
}) {
  const strip = useFilmstrip(asset?.id, asset?.url);

  if (!strip || strip.frames.length === 0) {
    return <Placeholder label="loading…" />;
  }

  const speed = clip.speed || 1;
  const sourceStart = clip.inPoint;
  const sourceEnd = clip.inPoint + clip.duration * speed;
  const sourceSpan = Math.max(0.001, sourceEnd - sourceStart);
  /* Pixels per second of source video, in clip coordinates. */
  const pxPerSourceSec = width / sourceSpan;

  /* The filmstrip generator samples a fixed number of frames (8 by
     default — see lib/editor/filmstrip.ts). Anchoring each frame at its
     source time and rendering at native aspect leaves visible gaps when
     the clip is wider than the frames collectively cover. Instead, lay
     out each frame as a *segment* spanning from its time anchor to the
     next frame's time anchor (the last frame fills the trailing slice
     to the clip's right edge, the first starts at the left edge). With
     `object-fit: cover` the source aspect ratio is preserved — the
     edges crop a hair rather than stretching — so the lane reads as a
     continuous strip at every zoom level. */
  const frames = strip.frames;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        borderRadius: 6,
      }}
      aria-hidden="true"
    >
      {frames.map((frame, i) => {
        const segmentStart =
          i === 0
            ? 0
            : (frame.time - sourceStart) * pxPerSourceSec;
        const segmentEnd =
          i === frames.length - 1
            ? width
            : (frames[i + 1].time - sourceStart) * pxPerSourceSec;
        const segmentWidth = Math.max(0, segmentEnd - segmentStart);
        if (segmentWidth <= 0 || segmentEnd < 0 || segmentStart > width) {
          return null;
        }
        /* `next/image` can't optimise data: URLs (no static dimensions, no
           CDN to round-trip through), so the warning is irrelevant here. */
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={frame.time}
            src={frame.url}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: segmentStart,
              top: 0,
              width: segmentWidth,
              height,
              objectFit: "cover",
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
        );
      })}
    </div>
  );
}

/* ── Image ───────────────────────────────────────────────────────────── */

function ImageBody({ asset }: { asset: ClipBodyContext["asset"] }) {
  if (!asset?.thumbnail) return <Placeholder label="image" />;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `url(${asset.thumbnail})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        borderRadius: 6,
      }}
    />
  );
}

/* ── Placeholder ─────────────────────────────────────────────────────── */

function Placeholder({ label }: { label: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(255,255,255,0.04)",
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        color: "rgba(255,255,255,0.4)",
      }}
    >
      {label}
    </div>
  );
}
