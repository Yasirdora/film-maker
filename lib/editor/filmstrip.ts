"use client";

/**
 * Filmstrip generation — extracts evenly-spaced thumbnails from a video
 * asset and caches the result per (asset, frameCount, frameWidth) key.
 *
 * Used by the video editor's lane to render a real filmstrip behind each
 * video clip — far more readable than stretching one cached thumbnail
 * across a long clip at high zoom.
 *
 * Adaptive frame count
 * --------------------
 * The number of thumbnails scales with the source duration so short
 * clips don't burn seeks on redundant frames and long clips don't stay
 * cartoonishly sparse:
 *
 *   • ~1 frame every `FRAME_INTERVAL_SEC` seconds of source.
 *   • Clamped to `[MIN_FRAME_COUNT, MAX_FRAME_COUNT]` so a 1-second clip
 *     still gets a recognisable strip and a 2-hour file doesn't cost
 *     hundreds of seeks at import time.
 *
 * This matches what CapCut Web and Veed do, and approximates Premiere
 * and DaVinci's medium-density default. Callers can still override via
 * `FilmstripOptions.frameCount` for tests / fixed-density use cases.
 *
 * Generation pipeline
 * -------------------
 * Sequential seeks on a hidden <video> element: load → seek → draw to
 * canvas → toDataURL → repeat. Sequential because seeking before the
 * previous seek resolves causes most browsers to drop the earlier
 * frame. Cached promises are shared between concurrent callers so the
 * same asset never spins up two generators in parallel.
 */

import { useEffect, useState } from "react";

export type FilmstripFrame = {
  /** Source-video time in seconds. */
  time: number;
  /** JPEG data-url. */
  url: string;
};

export type Filmstrip = {
  /** Total duration of the source video, in seconds. */
  duration: number;
  /** Frame dimensions in pixels (all frames share these). */
  frameWidth: number;
  frameHeight: number;
  /** Frames in time order. */
  frames: FilmstripFrame[];
};

export type FilmstripOptions = {
  /**
   * Override the adaptive frame count. When omitted the count is
   * derived from the source duration (see `computeAdaptiveFrameCount`),
   * which is the right answer for nearly every caller — a 1-second
   * clip doesn't need 32 frames, and a 30-minute clip needs more than 8.
   * Override only when test fixtures or fixed-density rendering
   * require a known value.
   */
  frameCount?: number;
  /** Target frame width in pixels. The natural source aspect ratio is
   *  preserved; frame height is derived. Default 160. */
  frameWidth?: number;
};

/* ─── Adaptive frame-count tuning ─────────────────────────────────────
 * Exported so the values surface in autocompletion and so tests / other
 * tools can read them without re-defining the formula. They live as
 * constants rather than as function arguments because the policy is a
 * project-wide UX choice, not a per-call concern.
 */

/** Target source-time interval between thumbnails (seconds). One frame
 *  every ~2s mirrors CapCut Web's default and reads well at typical
 *  zoom levels. Lower = denser strips, more seeks. */
export const FRAME_INTERVAL_SEC = 2;

/** Floor on the strip length. Below this, very short clips would
 *  render as a single image which loses the "this is a video" cue. */
export const MIN_FRAME_COUNT = 4;

/** Ceiling on the strip length. Above this, generation cost (seeks +
 *  encoded sprite size) outweighs the visual win — beyond ~64 frames
 *  individual thumbnails are smaller than recognisable. */
export const MAX_FRAME_COUNT = 64;

/**
 * Picks a frame count that scales with the source duration. The
 * formula is intentionally simple — ~1 frame per FRAME_INTERVAL_SEC,
 * clamped to [MIN_FRAME_COUNT, MAX_FRAME_COUNT] — so the behaviour is
 * predictable and easy to tune without rebalancing a curve.
 *
 * Examples (with the current defaults):
 *   • 1 s  → 4 frames  (clamped to the floor)
 *   • 30 s → 15 frames
 *   • 5 m  → 64 frames (clamped to the ceiling)
 *   • 2 h  → 64 frames (clamped; each thumb covers ~2 min)
 *
 * Returns the floor for zero / non-finite durations so the caller can
 * still produce a placeholder strip if the metadata is incomplete.
 */
export function computeAdaptiveFrameCount(durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return MIN_FRAME_COUNT;
  const ideal = Math.round(durationSec / FRAME_INTERVAL_SEC);
  return Math.max(MIN_FRAME_COUNT, Math.min(MAX_FRAME_COUNT, ideal));
}

const cache = new Map<string, Promise<Filmstrip>>();

/** Sentinel used as a stable cache-key fragment when the caller leaves
 *  the frame count to the adaptive policy. Callers that override get
 *  their explicit number in the key instead, so explicit and adaptive
 *  caches never collide. */
const ADAPTIVE_KEY = "auto";

/** Default frame width when the caller doesn't override. 160px reads
 *  cleanly on retina lanes; trade-off explained in the module header. */
const DEFAULT_FRAME_WIDTH = 160;

/**
 * Returns a cached filmstrip if one exists, or kicks off generation.
 * Same asset / same options always returns the same promise — never
 * duplicates work between concurrent callers.
 *
 * When `opts.frameCount` is omitted, the count is decided by the
 * adaptive policy in `computeAdaptiveFrameCount` *after* the source
 * duration is known (i.e. inside `generate`). All adaptive callers
 * share one cache entry per asset since the policy is deterministic
 * for a given duration.
 */
export function getFilmstrip(
  assetId: string,
  url: string,
  opts: FilmstripOptions = {},
): Promise<Filmstrip> {
  const frameWidth = opts.frameWidth ?? DEFAULT_FRAME_WIDTH;
  const countKey = opts.frameCount ?? ADAPTIVE_KEY;
  const key = `${assetId}:${countKey}:${frameWidth}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = generate(url, opts.frameCount, frameWidth).catch((err) => {
      cache.delete(key);
      throw err;
    });
    cache.set(key, pending);
  }
  return pending;
}

/**
 * Probes the video, picks the effective frame count (caller override
 * or adaptive policy), and seeks through the source to capture each
 * thumbnail. Returns an empty strip when metadata is missing — callers
 * fall back to a placeholder in that case.
 */
async function generate(
  url: string,
  frameCountOverride: number | undefined,
  frameWidth: number,
): Promise<Filmstrip> {
  const v = document.createElement("video");
  v.preload = "auto";
  v.muted = true;
  v.crossOrigin = "anonymous";
  v.src = url;

  await new Promise<void>((resolve, reject) => {
    const onLoaded = () => {
      v.removeEventListener("loadeddata", onLoaded);
      v.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      v.removeEventListener("loadeddata", onLoaded);
      v.removeEventListener("error", onError);
      reject(new Error("video load failed"));
    };
    v.addEventListener("loadeddata", onLoaded);
    v.addEventListener("error", onError);
  });

  const duration = isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
  if (!duration || !v.videoWidth || !v.videoHeight) {
    return { duration: 0, frameWidth: 0, frameHeight: 0, frames: [] };
  }

  /* Resolve the frame count *after* we know the duration. The override
     path is preserved for tests / explicit-density callers; production
     callers leave it undefined and pick up the adaptive policy. */
  const frameCount =
    frameCountOverride !== undefined
      ? Math.max(1, Math.floor(frameCountOverride))
      : computeAdaptiveFrameCount(duration);

  const fw = Math.min(frameWidth, v.videoWidth);
  const fh = Math.round((fw / v.videoWidth) * v.videoHeight);
  const canvas = document.createElement("canvas");
  canvas.width = fw;
  canvas.height = fh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2D context unavailable");

  const frames: FilmstripFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    /* Sample at the centre of each interval so the first frame isn't a
       black title card and the last isn't an end-card. */
    const t = ((i + 0.5) * duration) / frameCount;
    const target = Math.min(t, Math.max(0, duration - 0.05));
    await seekTo(v, target);
    ctx.drawImage(v, 0, 0, fw, fh);
    frames.push({ time: target, url: canvas.toDataURL("image/jpeg", 0.65) });
  }

  return { duration, frameWidth: fw, frameHeight: fh, frames };
}

function seekTo(v: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("error", onError);
      reject(new Error("seek failed"));
    };
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("error", onError);
    v.currentTime = time;
  });
}

/**
 * React hook: load a filmstrip for the given asset. Returns null until the
 * first frame is ready, then the full strip. Aborts (sets state to null)
 * if the asset changes mid-flight.
 */
export function useFilmstrip(
  assetId: string | undefined,
  url: string | undefined,
  opts?: FilmstripOptions,
): Filmstrip | null {
  const [strip, setStrip] = useState<Filmstrip | null>(null);
  /* opts is destructured so the dep array stays primitive — passing a
     freshly-allocated `opts` object every render would re-run the effect
     forever. */
  const frameCount = opts?.frameCount;
  const frameWidth = opts?.frameWidth;

  useEffect(() => {
    if (!assetId || !url) return;
    let cancelled = false;
    getFilmstrip(assetId, url, { frameCount, frameWidth })
      .then((s) => { if (!cancelled) setStrip(s); })
      .catch(() => { /* swallow — VideoClipBody falls back to its placeholder. */ });
    return () => { cancelled = true; };
  }, [assetId, url, frameCount, frameWidth]);

  return strip;
}
