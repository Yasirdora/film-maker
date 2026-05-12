export type Category = "universal" | "image" | "video" | "audio";
export type ScopedCategory = Exclude<Category, "universal">;

/**
 * Per-category output formats. Image entries must be encodable by the browser
 * via `HTMLCanvasElement.toBlob`; video and audio formats are produced by
 * FFmpeg.wasm with codec choices defined in `conversion.ts`.
 */
export const FORMAT_CATALOG: Record<ScopedCategory, readonly string[]> = {
  image: ["PNG", "JPG", "WEBP", "AVIF", "BMP"],
  video: ["MP4", "MOV", "WEBM", "AVI", "MKV"],
  audio: ["MP3", "WAV", "AAC", "FLAC", "OGG", "M4A"],
};

export const ALL_FORMATS: readonly string[] = [
  ...FORMAT_CATALOG.image,
  ...FORMAT_CATALOG.video,
  ...FORMAT_CATALOG.audio,
];

export interface CategoryConfig {
  category: Category;
  title: string;
  subtitle: string;
  /** Input options shown in the empty-state Input dropdown (scoped pages only). */
  inputFormats: readonly string[];
  /** Output options shown in the empty-state Output dropdown and per-row pill (scoped pages only). */
  outputFormats: readonly string[];
  defaultOutput: string;
  /** `accept` attribute for the underlying <input type="file">. */
  acceptAttribute?: string;
  /** When true, per-row format options are scoped to each file's detected category. */
  isUniversal: boolean;
}

export const CONFIGS: Record<Category, CategoryConfig> = {
  universal: {
    category: "universal",
    title: "Media Converter",
    subtitle:
      "Convert, transform, optimize and more. Use Film-maker's AI optimised media converter to turn your photos, videos and audios into a format suited for your project.",
    inputFormats: ["Auto detect"],
    outputFormats: ALL_FORMATS,
    defaultOutput: "PNG",
    isUniversal: true,
  },
  image: {
    category: "image",
    title: "Image Converter",
    subtitle: "Convert images between PNG, JPG, WEBP, AVIF, and BMP.",
    inputFormats: ["Auto detect", ...FORMAT_CATALOG.image],
    outputFormats: FORMAT_CATALOG.image,
    defaultOutput: "PNG",
    acceptAttribute: "image/*",
    isUniversal: false,
  },
  video: {
    category: "video",
    title: "Video Converter",
    subtitle: "Convert videos between MP4, MOV, WEBM, and more.",
    inputFormats: ["Auto detect", ...FORMAT_CATALOG.video],
    outputFormats: FORMAT_CATALOG.video,
    defaultOutput: "MP4",
    acceptAttribute: "video/*",
    isUniversal: false,
  },
  audio: {
    category: "audio",
    title: "Audio Converter",
    subtitle: "Convert audio between MP3, WAV, FLAC, and more.",
    inputFormats: ["Auto detect", ...FORMAT_CATALOG.audio],
    outputFormats: FORMAT_CATALOG.audio,
    defaultOutput: "MP3",
    acceptAttribute: "audio/*",
    isUniversal: false,
  },
};

const EXT_TO_CATEGORY: Record<string, ScopedCategory> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
  bmp: "image",
  tiff: "image",
  tif: "image",
  heic: "image",
  heif: "image",
  ico: "image",
  svg: "image",
  avif: "image",
  mp4: "video",
  mov: "video",
  webm: "video",
  avi: "video",
  mkv: "video",
  flv: "video",
  wmv: "video",
  m4v: "video",
  mp3: "audio",
  wav: "audio",
  aac: "audio",
  flac: "audio",
  ogg: "audio",
  m4a: "audio",
  wma: "audio",
};

/**
 * Detects the broad media category for a file. Returns `null` for files that
 * aren't a supported image, video, or audio type so callers can reject them.
 */
export function detectCategory(file: File): ScopedCategory | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  const ext = extensionOf(file.name).toLowerCase();
  return EXT_TO_CATEGORY[ext] ?? null;
}

export function defaultOutputFor(category: ScopedCategory): string {
  return CONFIGS[category].defaultOutput;
}

export function formatsFor(category: ScopedCategory): readonly string[] {
  return FORMAT_CATALOG[category];
}

export function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toUpperCase() : "FILE";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
