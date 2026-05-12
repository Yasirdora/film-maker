"use client";

/**
 * Filmstrip generation — extracts N evenly-spaced thumbnails from a video
 * asset and caches the result per (asset, frameCount, frameWidth) key.
 *
 * Used by the video editor's lane to render a real filmstrip behind each
 * video clip — far more readable than stretching one cached thumbnail
 * across a long clip at high zoom.
 *
 * Generation runs in series on a hidden <video> element: load → seek →
 * draw to canvas → toDataURL → repeat. Sequential because seeking before
 * the previous seek resolves causes most browsers to drop the earlier
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
  /** How many frames to extract. Default 8 — enough texture to read at most
   *  zoom levels without paying for 16+ seeks per asset. */
  frameCount?: number;
  /** Target frame width in pixels. The natural source aspect ratio is
   *  preserved; frame height is derived. Default 160. */
  frameWidth?: number;
};

const cache = new Map<string, Promise<Filmstrip>>();

/**
 * Returns a cached filmstrip if one exists, or kicks off generation. Same
 * asset / same options always returns the same promise — never duplicates
 * work between concurrent callers.
 */
export function getFilmstrip(
  assetId: string,
  url: string,
  opts: FilmstripOptions = {},
): Promise<Filmstrip> {
  const frameCount = opts.frameCount ?? 8;
  const frameWidth = opts.frameWidth ?? 160;
  const key = `${assetId}:${frameCount}:${frameWidth}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = generate(url, frameCount, frameWidth).catch((err) => {
      cache.delete(key);
      throw err;
    });
    cache.set(key, pending);
  }
  return pending;
}

async function generate(url: string, frameCount: number, frameWidth: number): Promise<Filmstrip> {
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
