"use client";

import { AudioClip, Combinator, OffscreenSprite } from "@webav/av-cliper";
import type { EditorState, MediaClip } from "../editor/types";

export type AudioExportFormat = "mp3" | "wav" | "m4a" | "mp4" | "ogg" | "flac";

export type AudioExportOptions = {
  format: AudioExportFormat;
  /**
   * mp3 → kbps (e.g. 192, 320)
   * m4a → kbps (e.g. 192, 256)
   * wav/flac → ignored (lossless)
   * ogg → not supported (will throw)
   */
  quality: number;
  channels: 1 | 2;
};

export type ExportProgress = { pct: number; message: string };

const SR = 48_000;

/**
 * Multi-track audio export.
 *
 * Renders all unmuted audio tracks via OfflineAudioContext (hardware-
 * accelerated, faster than real-time), then encodes to the requested format:
 *   wav  → pure-JS RIFF/PCM encoder (no extra deps)
 *   mp3  → lamejs (in-browser LAME port)
 *   m4a  → WebAV AudioClip → Combinator (WebCodecs AAC + MP4 mux)
 *   ogg  → not supported; a descriptive error is thrown
 */
export async function exportAudioProject(
  state: Pick<EditorState, "assets" | "clips" | "clipOrder" | "tracks">,
  opts: AudioExportOptions,
  onProgress: (p: ExportProgress) => void,
): Promise<Blob> {
  if (opts.format === "ogg") {
    throw new Error(
      "OGG Vorbis encoding requires FFmpeg, which has been removed. " +
        "Please choose WAV, MP3, or M4A instead.",
    );
  }

  const audioTrackIds = state.tracks
    .filter((t) => !t.muted)
    .map((t) => t.id);

  const clipsOnTracks = state.clipOrder
    .map((id) => state.clips[id])
    .filter(
      (c): c is MediaClip =>
        !!c && (c.kind === "audio" || c.kind === "video") && audioTrackIds.includes(c.trackId),
    )
    .sort((a, b) => a.start - b.start);

  if (clipsOnTracks.length === 0) throw new Error("No audible audio clips to export.");

  onProgress({ pct: 0, message: "Loading sources…" });

  // ── decode source files ──────────────────────────────────────────────────
  const tmpCtx = new AudioContext();
  const decodedByAsset: Record<string, AudioBuffer> = {};

  const uniqueClips: MediaClip[] = clipsOnTracks.filter(
    (c, i, arr) => arr.findIndex((x) => x.assetId === c.assetId) === i,
  );

  for (let i = 0; i < uniqueClips.length; i++) {
    const c = uniqueClips[i];
    const asset = state.assets[c.assetId];
    if (!asset) continue;
    const arrayBuf = await fetch(asset.url).then((r) => r.arrayBuffer());
    decodedByAsset[c.assetId] = await tmpCtx.decodeAudioData(arrayBuf);
    onProgress({ pct: 5 + (30 * (i + 1)) / uniqueClips.length, message: "Loading sources…" });
  }
  await tmpCtx.close();

  // ── offline render ────────────────────────────────────────────────────────
  const totalDuration = clipsOnTracks.reduce((mx, c) => Math.max(mx, c.start + c.duration), 0);
  const offCtx = new OfflineAudioContext(opts.channels || 2, Math.ceil(totalDuration * SR), SR);

  for (const c of clipsOnTracks) {
    const srcBuf = decodedByAsset[c.assetId];
    if (!srcBuf) continue;

    const speed = clamp(c.speed ?? 1, 0.1, 4);
    const vol = Math.max(0, c.volume ?? 1);

    const src = offCtx.createBufferSource();
    src.buffer = srcBuf;
    src.playbackRate.value = speed;

    const gain = offCtx.createGain();

    if (c.fadeIn > 0.005) {
      gain.gain.setValueAtTime(0, c.start);
      gain.gain.linearRampToValueAtTime(vol, c.start + c.fadeIn);
    } else {
      gain.gain.setValueAtTime(vol, c.start);
    }

    if (c.fadeOut > 0.005) {
      const fadeStart = c.start + c.duration - c.fadeOut;
      gain.gain.setValueAtTime(vol, fadeStart);
      gain.gain.linearRampToValueAtTime(0, c.start + c.duration);
    }

    src.connect(gain);
    gain.connect(offCtx.destination);

    // start(outputWhen, sourceOffset, sourceDuration)
    src.start(c.start, c.inPoint, c.duration * speed);
    src.stop(c.start + c.duration);
  }

  onProgress({ pct: 40, message: "Rendering mix…" });
  const rendered = await offCtx.startRendering();
  onProgress({ pct: 80, message: "Encoding…" });

  // ── encode ────────────────────────────────────────────────────────────────
  let blob: Blob;
  switch (opts.format) {
    case "wav":
      blob = encodeWav(rendered);
      break;
    case "mp3":
      blob = await encodeMp3(rendered, opts.quality);
      break;
    case "m4a":
      blob = await encodeM4A(rendered);
      break;
    case "mp4":
      blob = await encodeMp4(rendered, opts.quality);
      break;
    case "flac":
      blob = await encodeFLAC(rendered);
      break;
    default:
      throw new Error(`Unknown format: ${opts.format}`);
  }

  onProgress({ pct: 100, message: "Done" });
  return blob;
}

// ── WAV encoder ──────────────────────────────────────────────────────────────

function encodeWav(buf: AudioBuffer): Blob {
  const nCh = buf.numberOfChannels;
  const nSamples = buf.length;
  const blockAlign = nCh * 2; // 16-bit
  const dataSize = nSamples * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const v = new DataView(ab);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };

  str(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, nCh, true);
  v.setUint32(24, buf.sampleRate, true);
  v.setUint32(28, buf.sampleRate * blockAlign, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, dataSize, true);

  let off = 44;
  for (let i = 0; i < nSamples; i++) {
    for (let ch = 0; ch < nCh; ch++) {
      const s = buf.getChannelData(ch)[i];
      v.setInt16(off, Math.max(-32768, Math.min(32767, Math.round(s * 32767))), true);
      off += 2;
    }
  }

  return new Blob([ab], { type: "audio/wav" });
}

// ── MP3 encoder (FFmpeg) ──────────────────────────────────────────────────────

async function encodeMp3(buf: AudioBuffer, kbps: number): Promise<Blob> {
  const wavBlob = encodeWav(buf);

  const { getFFmpeg } = await import("../editor/ffmpeg");
  const { fetchFile } = await import("@ffmpeg/util");

  const ff = await getFFmpeg();

  const inputName = "mixdown.wav";
  const outputName = "mixdown.mp3";

  await ff.writeFile(inputName, await fetchFile(wavBlob));

  const code = await ff.exec([
    "-i", inputName,
    "-c:a", "libmp3lame",
    "-b:a", `${kbps}k`,
    outputName,
  ]);

  if (code !== 0) {
    await ff.deleteFile(inputName);
    throw new Error("FFmpeg MP3 encoding failed with code: " + code);
  }

  const data = await ff.readFile(outputName);

  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);

  return new Blob([data as any], { type: "audio/mpeg" });
}

// ── M4A encoder (WebAV AudioClip → Combinator → AAC/MP4) ─────────────────────

async function encodeM4A(buf: AudioBuffer): Promise<Blob> {
  const wavBlob = encodeWav(buf);
  
  const { getFFmpeg } = await import("../editor/ffmpeg");
  const { fetchFile } = await import("@ffmpeg/util");
  
  const ff = await getFFmpeg();
  
  const inputName = "mixdown.wav";
  const outputName = "mixdown.m4a";
  
  await ff.writeFile(inputName, await fetchFile(wavBlob));
  
  const code = await ff.exec(["-i", inputName, "-c:a", "aac", "-b:a", "256k", outputName]);
  
  if (code !== 0) {
    await ff.deleteFile(inputName);
    throw new Error("FFmpeg M4A encoding failed with code: " + code);
  }
  
  const data = await ff.readFile(outputName);
  
  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);
  
  return new Blob([data as any], { type: "audio/mp4" });
}

// ── MP4 encoder (audio-only MP4 with AAC via FFmpeg) ──────────────────────────

async function encodeMp4(buf: AudioBuffer, kbps: number): Promise<Blob> {
  const wavBlob = encodeWav(buf);

  const { getFFmpeg } = await import("../editor/ffmpeg");
  const { fetchFile } = await import("@ffmpeg/util");

  const ff = await getFFmpeg();

  const inputName = "mixdown.wav";
  const outputName = "mixdown.mp4";

  await ff.writeFile(inputName, await fetchFile(wavBlob));

  // Audio-only MP4: encode WAV → AAC and mux into an MP4 container.
  // -vn ensures no dummy video stream is created.
  const code = await ff.exec([
    "-i", inputName,
    "-vn",
    "-c:a", "aac",
    "-b:a", `${kbps}k`,
    outputName,
  ]);

  if (code !== 0) {
    await ff.deleteFile(inputName);
    throw new Error("FFmpeg MP4 encoding failed with code: " + code);
  }

  const data = await ff.readFile(outputName);

  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);

  return new Blob([data as any], { type: "video/mp4" });
}

// ── FLAC encoder ──────────────────────────────────────────────────────────────

async function encodeFLAC(buf: AudioBuffer): Promise<Blob> {
  const wavBlob = encodeWav(buf);
  
  const { getFFmpeg } = await import("../editor/ffmpeg");
  const { fetchFile } = await import("@ffmpeg/util");
  
  const ff = await getFFmpeg();
  
  const inputName = "mixdown.wav";
  const outputName = "mixdown.flac";
  
  await ff.writeFile(inputName, await fetchFile(wavBlob));
  
  const code = await ff.exec(["-i", inputName, "-c:a", "flac", outputName]);
  
  if (code !== 0) {
    await ff.deleteFile(inputName);
    throw new Error("FFmpeg FLAC encoding failed with code: " + code);
  }
  
  const data = await ff.readFile(outputName);
  
  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);
  
  return new Blob([data as any], { type: "audio/flac" });
}

// ── utils ─────────────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
