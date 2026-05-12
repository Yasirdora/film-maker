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
  /* Render the frame at its native aspect; height fills the clip body. */
  const frameDisplayWidth = (height / strip.frameHeight) * strip.frameWidth;

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
      {strip.frames.map((frame) => {
        /* Centre each frame on its source time so the lane reads as a
           continuous strip even when the source span is short. */
        const x = (frame.time - sourceStart) * pxPerSourceSec - frameDisplayWidth / 2;
        if (x + frameDisplayWidth < 0 || x > width) return null;
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
              left: x,
              top: 0,
              width: frameDisplayWidth,
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
