"use client";

import { Combinator, OffscreenSprite, MP4Clip, AudioClip } from "@webav/av-cliper";
import { getFFmpeg } from "./ffmpeg";
import type { Clip, EditorState } from "./types";

/**
 * Output containers supported by the video editor:
 *   • `mp4` — WebAV's native H.264/AAC output. No post-processing, fastest.
 *   • `mov` — same H.264/AAC streams in a QuickTime container. FFmpeg
 *             `-c copy` rewrap, so it's only marginally slower than mp4.
 *
 * WebM was tried but pulled: the default `@ffmpeg/core@0.12.10` UMD
 * build doesn't reliably ship the libvpx encoder, so attempting a VP8
 * encode crashed wasm with "memory access out of bounds". Re-adding it
 * would require either swapping to `core-mt` (which requires
 * COOP/COEP headers) or going the MediaRecorder route for VP8/Opus.
 */
export type ExportFormat = "mp4" | "mov";

export type ExportOptions = {
  format: ExportFormat;
  width: number;
  height: number;
  fps: number;
  /** Quality hint mapped to an approximate bitrate; WebAV does not use CRF. */
  crf: number;
};

export type ExportProgress = { pct: number; message: string };

/** MIME type for the final blob, picked from the chosen container. */
export function mimeTypeFor(format: ExportFormat): string {
  switch (format) {
    case "mp4":
      return "video/mp4";
    case "mov":
      /* `video/quicktime` is the registered MIME for .mov, but many
         servers and download dialogs only recognise the historical
         `video/mp4` alias. We use the registered one and let the file
         extension carry the rest. */
      return "video/quicktime";
  }
}

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

    // Translate the editor's clip-center coordinates into WebAV's
    // sprite-top-left rect.
    //
    // In the editor, `transform.x` / `transform.y` are absolute canvas
    // coordinates of the clip's *center* (see `defaultTransform` in
    // `store.ts` which seeds them to `canvas.width/2`, `canvas.height/2`,
    // and `PreviewStage` which renders Konva nodes with `offsetX = w/2`,
    // `offsetY = h/2`).
    //
    // WebAV's `OffscreenSprite.rect.x|y` is the top-left of the sprite
    // in output-canvas pixels, so subtract half the scaled clip size to
    // place the center at (x, y). Rounding keeps the sprite on integer
    // pixels — sub-pixel positioning can cause faint seams on the
    // output edge.
    const { x, y, scale, rotation, opacity, flipX, flipY } = c.transform;
    const w = asset.width * scale;
    const h = asset.height * scale;
    spr.rect.x = Math.round(x - w / 2);
    spr.rect.y = Math.round(y - h / 2);
    spr.rect.w = Math.round(w);
    spr.rect.h = Math.round(h);
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

  /* MP4 is the native WebAV output — we're done. MOV needs a quick
     pass through FFmpeg.wasm to rewrap the same H.264/AAC streams in
     a QuickTime container (`-c copy -f mov`, no re-encode). */
  if (opts.format === "mp4") {
    onProgress({ pct: 100, message: "Done" });
    return new Blob([merged], { type: mimeTypeFor("mp4") });
  }

  return rewrapAsMov(merged, onProgress);
}

/**
 * Pipe the WebAV-produced MP4 stream through FFmpeg.wasm to rewrap the
 * same H.264/AAC streams in a QuickTime (.mov) container. `-c copy`
 * means no re-encode, so this completes in roughly the time it takes
 * to read and write the bytes — typically a fraction of a second even
 * for multi-minute exports.
 */
async function rewrapAsMov(
  mp4Bytes: Uint8Array,
  onProgress: (p: ExportProgress) => void,
): Promise<Blob> {
  onProgress({ pct: 99, message: "Repackaging as QuickTime (.mov)…" });

  const ff = await getFFmpeg();
  const inputName = "in.mp4";
  const outputName = "out.mov";
  await ff.writeFile(inputName, mp4Bytes);

  let logs = "";
  const onLog = ({ message }: { message: string }) => {
    logs += message + "\n";
  };
  ff.on("log", onLog);

  try {
    const exitCode = await ff.exec([
      "-i", inputName, "-c", "copy", "-f", "mov", outputName,
    ]);
    if (exitCode !== 0) {
      throw new Error(
        `FFmpeg failed to produce QuickTime (.mov) (exit ${exitCode}).\n${logs.slice(-2000)}`,
      );
    }

    const data = await ff.readFile(outputName);
    /* `readFile` returns a Uint8Array on a possibly-SharedArrayBuffer;
       copy into a fresh ArrayBuffer so the Blob constructor accepts it
       under strict TS typing (matches the reverseMediaFile pattern). */
    const bytes =
      typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);
    onProgress({ pct: 100, message: "Done" });
    return new Blob([bytes], { type: mimeTypeFor("mov") });
  } finally {
    ff.off("log", onLog);
    /* Always clean up the virtual filesystem so subsequent exports
       start from a known empty state. Failures here are non-fatal. */
    try { await ff.deleteFile(inputName); } catch { /* ignore */ }
    try { await ff.deleteFile(outputName); } catch { /* ignore */ }
  }
}

function crfToBitrate(crf: number): number {
  if (crf <= 20) return 8_000_000;
  if (crf <= 23) return 5_000_000;
  if (crf <= 26) return 3_000_000;
  return 2_000_000;
}
