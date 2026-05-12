"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { PeakData } from "@/lib/audio/peaks";

/**
 * Vector-stroked waveform render — one anti-aliased line per pixel column,
 * `lineCap: round`, fed by REAL peaks (no random noise).
 *
 * Why stroked instead of filled:
 *   Filled polygons look chunky at low zoom; stroked lines stay crisp at any
 *   density and read as "pro DAW". The cost is one stroke pass instead of
 *   one fill pass — same order, no measurable difference.
 *
 * Correctness:
 *   • DPR-aware: backing store at devicePixelRatio so it stays sharp on retina.
 *   • Slice-correct: respects clip in-point + duration so trimming doesn't
 *     re-decode, just shifts which buckets we read.
 *   • Bucket aggregation: when a single pixel column straddles multiple peak
 *     buckets, we take min/max over all of them — never undersample transients.
 *   • Stereo: top half = L, bottom half = R, mirrored. Mono renders centered.
 *   • Visual gain: louder clips literally look bigger via `gain` multiplier,
 *     clamped to [-1, +1] so we never escape the clip body.
 */

type Props = {
  peaks: PeakData;
  inPoint: number;
  duration: number;
  width: number;
  height: number;
  gain: number;
  color?: string;
  fadeIn?: number;
  fadeOut?: number;
};

/* Per-canvas pixel cap for the backing store. With dpr up to 3, this
   keeps the GPU allocation under ~12k × 6k — comfortably below browser
   element limits. Wider clips are tiled across multiple canvases so the
   waveform never truncates at high zoom (was: a single 8192 px cap,
   which made the right portion of long clips render blank when zoomed
   past their visible extent). */
const TILE_PX = 4096;

export default function WaveformCanvas({
  peaks,
  inPoint,
  duration,
  width,
  height,
  gain,
  color = "rgba(255,255,255,0.88)",
  fadeIn = 0,
  fadeOut = 0,
}: Props) {
  const totalW = Math.max(1, Math.round(width));
  const totalH = Math.max(1, Math.min(2048, Math.round(height)));
  /* Single canvas for the common case keeps allocation count flat. */
  if (totalW <= TILE_PX) {
    return (
      <Tile
        peaks={peaks}
        inPoint={inPoint}
        duration={duration}
        width={totalW}
        height={totalH}
        gain={gain}
        color={color}
        fadeIn={fadeIn}
        fadeOut={fadeOut}
        clipOffset={0}
        clipDuration={duration}
        leftPx={0}
      />
    );
  }
  /* Tile horizontally: each tile owns a slice of the source-time range,
     positioned absolutely so they line up flush with no rounding gap. */
  const tiles: ReactNode[] = [];
  let off = 0;
  while (off < totalW) {
    const tileW = Math.min(TILE_PX, totalW - off);
    const tileInPointFraction = off / totalW;
    const tileDurFraction = tileW / totalW;
    const tileInPoint = inPoint + tileInPointFraction * duration;
    const tileDuration = tileDurFraction * duration;
    const clipOffset = tileInPointFraction * duration;
    tiles.push(
      <Tile
        key={off}
        peaks={peaks}
        inPoint={tileInPoint}
        duration={tileDuration}
        width={tileW}
        height={totalH}
        gain={gain}
        color={color}
        fadeIn={fadeIn}
        fadeOut={fadeOut}
        clipOffset={clipOffset}
        clipDuration={duration}
        leftPx={off}
      />,
    );
    off += tileW;
  }
  return <>{tiles}</>;
}

type TileProps = {
  peaks: PeakData;
  inPoint: number;
  duration: number;
  width: number;
  height: number;
  gain: number;
  color: string;
  fadeIn: number;
  fadeOut: number;
  /* Where this tile starts within the FULL clip's time coordinate
     (seconds). Used to evaluate fade-in/out in clip-absolute terms even
     when the tile only covers part of the clip. */
  clipOffset: number;
  clipDuration: number;
  /* Visual x-offset within the clip body (CSS px). 0 for the only or
     leftmost tile; non-zero for subsequent tiles. */
  leftPx: number;
};

function Tile({
  peaks,
  inPoint,
  duration,
  width,
  height,
  gain,
  color,
  fadeIn,
  fadeOut,
  clipOffset,
  clipDuration,
  leftPx,
}: TileProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWaveform(
      ctx, peaks, inPoint, duration, width, height, gain, color,
      fadeIn, fadeOut, clipOffset, clipDuration,
    );
  }, [peaks, inPoint, duration, width, height, gain, color, fadeIn, fadeOut, clipOffset, clipDuration]);

  return (
    <canvas
      ref={ref}
      className="block pointer-events-none"
      style={{
        position: "absolute",
        left: leftPx,
        top: 0,
        // Soft drop shadow gives the waveform that premium DAW depth.
        filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.55))",
      }}
    />
  );
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  peaks: PeakData,
  inPoint: number,
  duration: number,
  width: number,
  height: number,
  gain: number,
  color: string,
  fadeIn: number,
  fadeOut: number,
  /* Absolute clip-time offset of x=0 in this canvas, plus the full clip
     duration, so fades stay continuous across tile boundaries. */
  clipOffset: number,
  clipDuration: number,
): void {
  ctx.clearRect(0, 0, width, height);

  const BAR_W = 2;
  const GAP = 1;
  const STRIDE = BAR_W + GAP;

  const channels = Math.min(2, peaks.channels);
  const channelHeight = height / channels;
  const halfH = channelHeight / 2;
  const usableHalfH = Math.max(1, halfH - 2);
  const g = Math.max(0, Math.min(4, gain));

  ctx.fillStyle = color;

  for (let ch = 0; ch < channels; ch++) {
    const channelPeaks = peaks.peaks[ch];
    const yCenter = ch * channelHeight + halfH;
    const lastBucket = (channelPeaks.length >> 1) - 1;

    for (let x = 0; x < width; x += STRIDE) {
      const t0 = inPoint + (x / width) * duration;
      const t1 = inPoint + ((x + BAR_W) / width) * duration;
      const b0 = Math.max(0, Math.floor(t0 * peaks.bucketsPerSecond));
      const b1 = Math.max(b0 + 1, Math.ceil(t1 * peaks.bucketsPerSecond));

      let peak = 0.008;
      for (let b = b0; b <= b1 && b <= lastBucket; b++) {
        const lo = Math.abs(channelPeaks[b * 2]);
        const hi = Math.abs(channelPeaks[b * 2 + 1]);
        if (lo > peak) peak = lo;
        if (hi > peak) peak = hi;
      }

      const clipTime = clipOffset + (x / width) * duration;
      let fadeGain = 1;
      if (fadeIn > 0 && clipTime < fadeIn) fadeGain = Math.min(fadeGain, clipTime / fadeIn);
      if (fadeOut > 0 && clipTime > clipDuration - fadeOut) fadeGain = Math.min(fadeGain, (clipDuration - clipTime) / fadeOut);

      const amplitude = Math.min(1, peak * g * fadeGain) * usableHalfH;
      ctx.fillRect(x, yCenter - amplitude, BAR_W, amplitude * 2);
    }
  }
}
