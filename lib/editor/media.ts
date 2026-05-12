"use client";

import type { MediaAsset } from "./types";

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  Math.random().toString(36).slice(2) + Date.now().toString(36);

export type ProbedAsset = MediaAsset & { file: File };

export async function probeFile(file: File): Promise<ProbedAsset> {
  const url = URL.createObjectURL(file);
  const mime = file.type || guessMimeFromName(file.name);
  const kind = mime.startsWith("video/")
    ? "video"
    : mime.startsWith("audio/")
      ? "audio"
      : "image";

  const base: ProbedAsset = {
    id: uid(),
    name: file.name,
    kind,
    url,
    duration: 0,
    width: 0,
    height: 0,
    size: file.size,
    mime,
    file,
  };

  if (kind === "video") {
    const meta = await probeVideo(url);
    base.duration = meta.duration;
    base.width = meta.width;
    base.height = meta.height;
    try {
      base.thumbnail = await videoThumbnail(url, Math.min(0.5, meta.duration / 2));
    } catch {
      /* ignore */
    }
  } else if (kind === "audio") {
    const meta = await probeAudio(url);
    base.duration = meta.duration;
  } else {
    const meta = await probeImage(url);
    base.width = meta.width;
    base.height = meta.height;
    base.thumbnail = url;
  }
  return base;
}

function guessMimeFromName(name: string) {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    aac: "audio/aac",
    ogg: "audio/ogg",
    flac: "audio/flac",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  return map[ext] ?? "application/octet-stream";
}

function probeVideo(
  url: string,
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.crossOrigin = "anonymous";
    v.onloadedmetadata = () =>
      resolve({
        duration: isFinite(v.duration) ? v.duration : 0,
        width: v.videoWidth,
        height: v.videoHeight,
      });
    v.onerror = () => reject(new Error("video probe failed"));
    v.src = url;
  });
}

function probeAudio(url: string): Promise<{ duration: number }> {
  return new Promise((resolve, reject) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.onloadedmetadata = () =>
      resolve({ duration: isFinite(a.duration) ? a.duration : 0 });
    a.onerror = () => reject(new Error("audio probe failed"));
    a.src = url;
  });
}

function probeImage(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("image probe failed"));
    img.src = url;
  });
}

function videoThumbnail(url: string, atTime: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.crossOrigin = "anonymous";
    v.src = url;
    const onSeeked = () => {
      const c = document.createElement("canvas");
      c.width = Math.min(320, v.videoWidth);
      c.height = Math.round((c.width / v.videoWidth) * v.videoHeight);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(v, 0, 0, c.width, c.height);
      try {
        resolve(c.toDataURL("image/jpeg", 0.7));
      } catch (e) {
        reject(e);
      }
    };
    v.onloadeddata = () => {
      v.currentTime = Math.min(atTime, v.duration - 0.05);
    };
    v.onseeked = onSeeked;
    v.onerror = () => reject(new Error("thumbnail failed"));
  });
}

export function fmtDuration(secs: number): string {
  if (!isFinite(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}
