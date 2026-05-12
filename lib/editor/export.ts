"use client";

import { Combinator, OffscreenSprite, MP4Clip, AudioClip } from "@webav/av-cliper";
import type { Clip, EditorState } from "./types";

export type ExportOptions = {
  format: "mp4" | "webm";
  width: number;
  height: number;
  fps: number;
  /** Quality hint mapped to an approximate bitrate; WebAV does not use CRF. */
  crf: number;
};

export type ExportProgress = { pct: number; message: string };

export async function exportProject(
  state: Pick<EditorState, "assets" | "clips" | "clipOrder" | "tracks" | "canvas">,
  opts: ExportOptions,
  onProgress: (p: ExportProgress) => void,
): Promise<Blob> {
  const { clips, clipOrder, tracks, assets, canvas: cvs } = state;

  const videoTrackIds = new Set(
    tracks.filter((t) => t.kind === "video" && !t.hidden).map((t) => t.id),
  );
  const audioTrackIds = new Set(
    tracks.filter((t) => t.kind === "audio" && !t.muted).map((t) => t.id),
  );

  const videoClips = clipOrder
    .map((id) => clips[id])
    .filter((c): c is Clip => !!c && c.kind === "video" && videoTrackIds.has(c.trackId))
    .sort((a, b) => a.start - b.start);

  const audioOnlyClips = clipOrder
    .map((id) => clips[id])
    .filter((c): c is Clip => !!c && c.kind === "audio" && audioTrackIds.has(c.trackId))
    .sort((a, b) => a.start - b.start);

  if (videoClips.length === 0) throw new Error("No video clips to export.");

  onProgress({ pct: 0, message: "Initialising compositor…" });

  const comb = new Combinator({
    width: opts.width,
    height: opts.height,
    fps: opts.fps,
    bgColor: cvs.background,
    bitrate: crfToBitrate(opts.crf),
  });

  let combError: Error | null = null;
  comb.on("error", (err) => { combError = err; });

  const totalClips = videoClips.length + audioOnlyClips.length;
  let loaded = 0;

  // ── video sprites ────────────────────────────────────────────────────────
  for (const c of videoClips) {
    if (c.kind !== "video") continue;
    const asset = assets[c.assetId];
    if (!asset) continue;

    onProgress({ pct: 5 + (60 * ++loaded) / totalClips, message: `Loading clip ${loaded}/${totalClips}…` });

    const res = await fetch(asset.url);
    const volume = Math.max(0, c.volume ?? 1);
    const mp4 = new MP4Clip(res.body!, { audio: volume > 0 ? { volume } : false });
    await mp4.ready;

    let sourceClip: MP4Clip = mp4;
    if (c.inPoint > 0.005) {
      const [, trimmed] = await mp4.split(Math.round(c.inPoint * 1e6));
      sourceClip = trimmed;
    }

    const spr = new OffscreenSprite(sourceClip);
    spr.time = {
      offset: Math.round(c.start * 1e6),
      duration: Math.round(c.duration * 1e6),
      playbackRate: Math.max(0.1, c.speed ?? 1),
    };

    // Store transform: canvas-center-relative → Rect top-left absolute
    const { x, y, scale, rotation, opacity, flipX, flipY } = c.transform;
    const w = asset.width * scale;
    const h = asset.height * scale;
    spr.rect.x = opts.width / 2 + x - w / 2;
    spr.rect.y = opts.height / 2 + y - h / 2;
    spr.rect.w = w;
    spr.rect.h = h;
    spr.rect.angle = (rotation * Math.PI) / 180;
    spr.opacity = opacity;
    // WebAV supports one flip axis at a time; flipX takes priority.
    spr.flip = flipX ? "horizontal" : flipY ? "vertical" : null;

    await comb.addSprite(spr);
  }

  // ── audio-only sprites ────────────────────────────────────────────────────
  for (const c of audioOnlyClips) {
    if (c.kind !== "audio") continue;
    const asset = assets[c.assetId];
    if (!asset) continue;

    onProgress({ pct: 5 + (60 * ++loaded) / totalClips, message: `Loading clip ${loaded}/${totalClips}…` });

    const res = await fetch(asset.url);
    const volume = Math.max(0, c.volume ?? 1);
    const audioClip = new AudioClip(res.body!, { volume });
    await audioClip.ready;

    let sourceClip: AudioClip = audioClip;
    if (c.inPoint > 0.005) {
      const [, trimmed] = await audioClip.split(Math.round(c.inPoint * 1e6));
      sourceClip = trimmed;
    }

    const spr = new OffscreenSprite(sourceClip);
    spr.time = {
      offset: Math.round(c.start * 1e6),
      duration: Math.round(c.duration * 1e6),
      playbackRate: Math.max(0.1, c.speed ?? 1),
    };

    await comb.addSprite(spr);
  }

  // ── encode ────────────────────────────────────────────────────────────────
  onProgress({ pct: 65, message: "Encoding…" });

  const unsubProgress = comb.on("OutputProgress", (pct) => {
    onProgress({ pct: 65 + pct * 33, message: "Encoding…" });
  });

  const chunks: Uint8Array[] = [];
  try {
    const reader = comb.output().getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (combError) throw combError;
      chunks.push(value);
    }
  } finally {
    unsubProgress();
    comb.destroy();
  }

  if (combError) throw combError;

  onProgress({ pct: 99, message: "Finalising…" });

  const total = chunks.reduce((s, c) => s + c.byteLength, 0);
  const merged = new Uint8Array(total);
  let off = 0;
  for (const chunk of chunks) { merged.set(chunk, off); off += chunk.byteLength; }

  onProgress({ pct: 100, message: "Done" });
  return new Blob([merged], { type: "video/mp4" });
}

function crfToBitrate(crf: number): number {
  if (crf <= 20) return 8_000_000;
  if (crf <= 23) return 5_000_000;
  if (crf <= 26) return 3_000_000;
  return 2_000_000;
}
