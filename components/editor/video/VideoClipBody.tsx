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

  /* Render the strip like physical film frames: each tile is sized at
     the thumbnail's native aspect (matching the lane height), and tiles
     pack edge-to-edge across the clip. The number of visible tiles is
     a function of the clip's rendered width — denser at high zoom,
     sparser at low zoom — so each tile is shown at (or below) its
     native pixel size and never stretches.
     This is the pattern CapCut Web / Premiere / DaVinci use, in
     contrast with our previous "one stretched thumbnail per source-
     time-segment" approach which made thumbs blocky at high zoom and
     squished at low zoom. */
  const tileWidth = (height / strip.frameHeight) * strip.frameWidth;
  if (tileWidth <= 0) return null;

  /* `ceil` lets the last tile spill off the right edge — `overflow:
     hidden` on the wrapper clips the partial frame, which mirrors how
     a physical filmstrip looks at a cut. */
  const tileCount = Math.max(1, Math.ceil(width / tileWidth));

  const speed = clip.speed || 1;
  const sourceStart = clip.inPoint;
  const sourceSpan = Math.max(0.001, clip.duration * speed);

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
      {Array.from({ length: tileCount }, (_, i) => {
        const x = i * tileWidth;
        /* Anchor each tile by its *centre* so the thumb represents the
           midpoint of the slice of source video that tile covers — the
           same convention the filmstrip generator uses internally. */
        const centreFraction = (x + tileWidth / 2) / width;
        const sourceTime = sourceStart + centreFraction * sourceSpan;
        const frame = pickClosestFrame(strip.frames, sourceTime);
        if (!frame) return null;
        /* `next/image` can't optimise data: URLs (no static dimensions,
           no CDN to round-trip through), so the warning is irrelevant
           here. */
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={frame.url}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: x,
              top: 0,
              width: tileWidth,
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

/**
 * Binary-friendly closest-frame lookup. Frames are produced in
 * monotonically increasing `time` order by the generator, so a linear
 * scan from the previous tile's hit would also work — but the simple
 * `reduce` keeps the code trivial and the cost (8–64 ops per tile, a
 * couple dozen tiles at most) is negligible against everything else
 * the timeline does per frame.
 */
function pickClosestFrame(
  frames: ReadonlyArray<{ time: number; url: string }>,
  target: number,
): { time: number; url: string } | undefined {
  if (frames.length === 0) return undefined;
  let best = frames[0];
  let bestDist = Math.abs(best.time - target);
  for (let i = 1; i < frames.length; i++) {
    const d = Math.abs(frames[i].time - target);
    if (d < bestDist) {
      best = frames[i];
      bestDist = d;
    }
  }
  return best;
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
