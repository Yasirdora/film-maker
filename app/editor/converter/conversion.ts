import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { getFFmpeg, preloadFFmpeg } from "@/lib/editor/ffmpeg";
import { ScopedCategory, extensionOf } from "./config";

/**
 * Result of a successful conversion. The caller owns the lifetime of `url`
 * (an object URL) and must call `URL.revokeObjectURL` when it's no longer
 * needed.
 */
export type ConversionResult = {
  blob: Blob;
  filename: string;
  url: string;
};

/** 0..1 progress callback. May be called many times or not at all. */
export type ProgressCallback = (ratio: number) => void;

/** MIME types for image outputs. Keys match `FORMAT_CATALOG.image`. */
const IMAGE_FORMAT_TO_MIME: Readonly<Record<string, string>> = {
  PNG: "image/png",
  JPG: "image/jpeg",
  WEBP: "image/webp",
  AVIF: "image/avif",
  BMP: "image/bmp",
};

/** MIME types for media outputs. Keys match `FORMAT_CATALOG.video|audio`. */
const MEDIA_FORMAT_TO_MIME: Readonly<Record<string, string>> = {
  MP4: "video/mp4",
  MOV: "video/quicktime",
  WEBM: "video/webm",
  AVI: "video/x-msvideo",
  MKV: "video/x-matroska",
  MP3: "audio/mpeg",
  WAV: "audio/wav",
  AAC: "audio/aac",
  FLAC: "audio/flac",
  OGG: "audio/ogg",
  M4A: "audio/mp4",
};

/**
 * Pre-warms the FFmpeg.wasm engine so the first conversion doesn't pay the
 * ~30 MB download cost. Safe to call multiple times — the load is shared
 * with the editor's reverse-clip flow via `lib/editor/ffmpeg.ts`.
 */
export function preloadMediaEngine(): Promise<void> {
  return preloadFFmpeg();
}

/**
 * Downloads a remote media file via our server-side proxy
 * (`/api/editor/converter/fetch`) and wraps it in a `File` so it can flow through
 * the same pipeline as locally-picked files.
 *
 * Throws an Error with a user-readable message on failure; callers should
 * surface it as a notice.
 */
export async function fetchUrlAsFile(url: string): Promise<File> {
  let res: Response;
  try {
    res = await fetch("/api/editor/converter/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw new Error("Network error — couldn't reach the proxy.");
  }
  if (!res.ok) {
    let message = `Couldn't fetch URL (HTTP ${res.status}).`;
    try {
      const data: unknown = await res.json();
      if (
        data &&
        typeof data === "object" &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
      ) {
        message = (data as { error: string }).error;
      }
    } catch {
      // Body wasn't JSON — keep generic message.
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const filename =
    res.headers.get("X-Filename") ??
    deriveFilenameFromUrl(url, blob.type) ??
    "download";
  // Some servers return generic application/octet-stream — preserve the
  // proxy's content-type which we already know to be image/video/audio.
  const type = blob.type || "application/octet-stream";
  return new File([blob], filename, { type });
}

function deriveFilenameFromUrl(url: string, type: string): string | null {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (!last) return null;
    if (last.includes(".")) return last;
    const ext = type.split("/")[1]?.split(";")[0] ?? "bin";
    return `${last}.${ext}`;
  } catch {
    return null;
  }
}

/**
 * Converts `file` to `targetFormat`. `category` selects the conversion path
 * (canvas for images, FFmpeg.wasm for audio/video). `onProgress` is invoked
 * with a 0..1 ratio when the underlying engine reports progress.
 */
export async function convertFile(
  file: File,
  category: ScopedCategory,
  targetFormat: string,
  onProgress?: ProgressCallback,
): Promise<ConversionResult> {
  const target = targetFormat.toUpperCase();
  const filename = `${stripExtension(file.name)}.${target.toLowerCase()}`;

  const blob =
    category === "image"
      ? await convertImage(file, target)
      : await convertMedia(file, target, onProgress);

  if (category === "image") onProgress?.(1);

  return {
    blob,
    filename,
    url: URL.createObjectURL(blob),
  };
}

// ─── Image conversion ────────────────────────────────────────────────────────

async function convertImage(file: File, format: string): Promise<Blob> {
  const mime = IMAGE_FORMAT_TO_MIME[format];
  if (!mime) {
    throw new Error(`Unsupported image format: ${format}`);
  }

  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Couldn't get a 2D canvas context");
  }

  // JPEG and BMP have no alpha — paint a white background so transparent
  // pixels in the source don't flatten to black.
  if (mime === "image/jpeg" || mime === "image/bmp") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);

  const blob = await canvasToBlob(canvas, mime);
  if (!blob) {
    throw new Error(
      `Your browser couldn't encode ${format}. Try a different output format.`,
    );
  }
  return blob;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          `Couldn't decode ${file.name}. The format may not be supported by this browser.`,
        ),
      );
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, mime, 0.92);
  });
}

// ─── Audio / Video conversion ────────────────────────────────────────────────

async function convertMedia(
  file: File,
  format: string,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const mime = MEDIA_FORMAT_TO_MIME[format];
  if (!mime) {
    throw new Error(`Unsupported media format: ${format}`);
  }

  const ffmpeg = await getFFmpeg();
  const inputName = `in_${randomId()}.${extensionOf(file.name).toLowerCase()}`;
  const outputName = `out_${randomId()}.${format.toLowerCase()}`;

  let progressHandler: ((event: { progress: number }) => void) | null = null;
  if (onProgress) {
    progressHandler = ({ progress }) => {
      // FFmpeg can briefly return values outside [0,1]; clamp for sanity.
      onProgress(Math.min(Math.max(progress, 0), 1));
    };
    ffmpeg.on("progress", progressHandler);
  }

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    await ffmpeg.exec(buildFFmpegArgs(inputName, outputName, format));
    const data = await ffmpeg.readFile(outputName);
    const buf = data instanceof Uint8Array ? data : new Uint8Array(0);
    // Copy into a fresh Uint8Array because FFmpeg reuses its internal buffer.
    return new Blob([new Uint8Array(buf)], { type: mime });
  } finally {
    if (progressHandler) ffmpeg.off("progress", progressHandler);
    await safeDelete(ffmpeg, inputName);
    await safeDelete(ffmpeg, outputName);
  }
}

async function safeDelete(ffmpeg: FFmpeg, name: string): Promise<void> {
  try {
    await ffmpeg.deleteFile(name);
  } catch {
    // The file may not exist if the conversion threw before writeFile,
    // or it was already cleaned up. Either way, nothing actionable.
  }
}

/**
 * Codec-aware FFmpeg argument builder. Each branch picks reasonable
 * production defaults; tune here if a specific output looks bad.
 */
function buildFFmpegArgs(
  input: string,
  output: string,
  format: string,
): string[] {
  switch (format) {
    case "MP3":
      return ["-i", input, "-c:a", "libmp3lame", "-q:a", "2", output];
    case "WAV":
      return ["-i", input, "-c:a", "pcm_s16le", output];
    case "AAC":
      return ["-i", input, "-c:a", "aac", "-b:a", "192k", output];
    case "M4A":
      return [
        "-i",
        input,
        "-vn",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        output,
      ];
    case "FLAC":
      return ["-i", input, "-c:a", "flac", output];
    case "OGG":
      return ["-i", input, "-c:a", "libvorbis", "-q:a", "5", output];
    case "MP4":
      return [
        "-i",
        input,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        output,
      ];
    case "MOV":
      return [
        "-i",
        input,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        output,
      ];
    case "WEBM":
      return [
        "-i",
        input,
        "-c:v",
        "libvpx-vp9",
        "-b:v",
        "0",
        "-crf",
        "32",
        "-c:a",
        "libopus",
        output,
      ];
    case "MKV":
      return [
        "-i",
        input,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        output,
      ];
    case "AVI":
      return [
        "-i",
        input,
        "-c:v",
        "mpeg4",
        "-q:v",
        "5",
        "-c:a",
        "libmp3lame",
        "-q:a",
        "2",
        output,
      ];
    default:
      // Fallback — let FFmpeg pick defaults from the output extension.
      return ["-i", input, output];
  }
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function stripExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(0, idx) : name;
}

function randomId(): string {
  return `${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
