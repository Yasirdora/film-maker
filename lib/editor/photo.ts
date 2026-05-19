"use client";

/**
 * Photo editor — small client-side utility module.
 *
 * Owns the file → image pipeline (decode incoming files into a paired
 * blob URL + ImageBitmap) and the canvas → blob export pipeline. Both
 * pieces are intentionally tiny and stateless so the photo editor's
 * components can stay React-shaped.
 *
 * • `decodeImage(file)` — accept any browser-decodable image file
 *   (PNG / JPEG / WebP / GIF / AVIF), return a `LoadedImage` with the
 *   raw pixel size + a blob URL for `<img>` display + an `ImageBitmap`
 *   for export operations.
 * • `exportImage(...)` — render an `ImageBitmap` to a fresh
 *   OffscreenCanvas at its natural dimensions and `convertToBlob` in
 *   the requested format. A 0.92 quality knob is used for the lossy
 *   formats; PNG ignores it.
 * • `revokeLoadedImage(img)` — release the bitmap + revoke the blob
 *   URL so we don't leak when the user opens a new file.
 */

export type ExportFormat = "png" | "jpeg" | "webp" | "avif";

/* Per-format capability table — keeps the dialog's format / transparency
 * / quality wiring honest in one place. PNG is lossless (no quality
 * knob) and supports alpha. JPEG is lossy and has no alpha channel.
 * WebP and AVIF are lossy by default and store alpha. */
export const FORMAT_CAPABILITIES: Record<
    ExportFormat,
    { lossless: boolean; transparency: boolean }
> = {
    png: { lossless: true, transparency: true },
    jpeg: { lossless: false, transparency: false },
    webp: { lossless: false, transparency: true },
    avif: { lossless: false, transparency: true },
};

export function isLossless(format: ExportFormat): boolean {
    return FORMAT_CAPABILITIES[format].lossless;
}

export function supportsTransparency(format: ExportFormat): boolean {
    return FORMAT_CAPABILITIES[format].transparency;
}

export interface LoadedImage {
    /** Object URL pointing at the original file — used for `<img src>`. */
    blobUrl: string;
    /** Pixel-perfect bitmap for export pipelines. */
    bitmap: ImageBitmap;
    /** Source file name (with extension) — used to suggest the export name. */
    fileName: string;
    /** Natural pixel width. */
    width: number;
    /** Natural pixel height. */
    height: number;
}

/**
 * The browser supports these natively via `createImageBitmap`. Other
 * formats (HEIC, TIFF, RAW…) require server-side or wasm decoders and
 * are intentionally rejected up-front so the user sees a clear error
 * rather than an inscrutable decode failure midway through the flow.
 */
const SUPPORTED_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/avif",
    "image/bmp",
]);

export function isSupportedImageFile(file: File): boolean {
    if (SUPPORTED_TYPES.has(file.type)) return true;
    /* Some operating systems supply files without a MIME type (e.g.
     * dragged from a non-cooperative app). Fall back to the extension
     * so the user isn't blocked by an OS quirk. */
    const ext = file.name.split(".").pop()?.toLowerCase();
    return (
        ext === "png" ||
        ext === "jpg" ||
        ext === "jpeg" ||
        ext === "webp" ||
        ext === "gif" ||
        ext === "avif" ||
        ext === "bmp"
    );
}

export async function decodeImage(file: File): Promise<LoadedImage> {
    if (!isSupportedImageFile(file)) {
        throw new Error(
            `Unsupported image type: ${file.type || file.name}. Try PNG, JPEG, WebP, GIF, AVIF, or BMP.`,
        );
    }

    /* `createImageBitmap` is the fastest path on every modern engine —
     * it decodes off-thread when possible and hands back a transferable
     * GPU-friendly bitmap. */
    const bitmap = await createImageBitmap(file);

    return {
        blobUrl: URL.createObjectURL(file),
        bitmap,
        fileName: file.name,
        width: bitmap.width,
        height: bitmap.height,
    };
}

export function revokeLoadedImage(img: LoadedImage | null): void {
    if (!img) return;
    try {
        URL.revokeObjectURL(img.blobUrl);
    } catch {
        /* ignore — already revoked. */
    }
    try {
        img.bitmap.close();
    } catch {
        /* ignore — already closed. */
    }
}

export function mimeFor(format: ExportFormat): string {
    switch (format) {
        case "png":
            return "image/png";
        case "jpeg":
            return "image/jpeg";
        case "webp":
            return "image/webp";
        case "avif":
            return "image/avif";
    }
}

export function extensionFor(format: ExportFormat): string {
    switch (format) {
        case "jpeg":
            return "jpg";
        default:
            return format;
    }
}

export interface ExportImageOptions {
    /** Encoder quality 0..1 (higher = better, larger file). Ignored
     *  for lossless formats. Defaults to 0.92 — the sweet-spot most
     *  image tools ship and the value Photoshop's "Save for Web"
     *  high-quality preset uses. */
    quality?: number;
    /** When `true`, the source's alpha channel is preserved (canvas
     *  starts transparent). When `false`, the bitmap is composited
     *  over `backgroundColor` first, so the resulting file is a
     *  flattened solid frame. Forced to `false` for formats with no
     *  alpha channel (JPEG); honored as the user chose for the rest. */
    transparent?: boolean;
    /** Background fill used when `transparent` is `false`. Defaults to
     *  white — the same colour browsers paint behind a JPEG that was
     *  decoded over no background. */
    backgroundColor?: string;
}

/**
 * Render `img.bitmap` at its native pixel size and produce a Blob in
 * the requested format. Uses `OffscreenCanvas` when available (every
 * shipped Chrome / Edge / Safari 17+ / Firefox 105+); falls back to a
 * detached `<canvas>` for older Safari builds where `OffscreenCanvas`
 * still lacks `convertToBlob`.
 *
 * Flattens onto `backgroundColor` when the user disabled transparency
 * (or when the chosen format has no alpha to write into).
 */
export async function exportImage(
    img: LoadedImage,
    format: ExportFormat,
    options: ExportImageOptions = {},
): Promise<Blob> {
    const mime = mimeFor(format);
    const quality = options.quality ?? 0.92;
    /* JPEG has no alpha — force a flatten regardless of the request. */
    const transparent =
        supportsTransparency(format) && (options.transparent ?? true);
    const backgroundColor = options.backgroundColor ?? "#ffffff";

    const paint = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => {
        if (!transparent) {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, img.width, img.height);
        }
        ctx.drawImage(img.bitmap, 0, 0);
    };

    if (typeof OffscreenCanvas !== "undefined") {
        const off = new OffscreenCanvas(img.width, img.height);
        const ctx = off.getContext("2d");
        if (!ctx) throw new Error("Failed to acquire 2D context.");
        paint(ctx);
        /* `convertToBlob` returns a Blob asynchronously off the main
         * thread when supported, which keeps the UI responsive on
         * large images. */
        return off.convertToBlob({ type: mime, quality });
    }

    /* Safari ≤16.3 fallback: paint into a detached canvas, then
     * `toBlob` it. The detached node never enters the DOM so it
     * doesn't trigger layout / paint. */
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to acquire 2D context.");
    paint(ctx);
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (blob) =>
                blob
                    ? resolve(blob)
                    : reject(new Error("Canvas produced an empty blob.")),
            mime,
            quality,
        );
    });
}

/**
 * Push a Blob to the user's downloads folder with a sensible name —
 * preserves the source's base name, swaps in the new extension.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    /* Tiny delay so the download has time to bind to the URL before
     * we revoke it; otherwise Safari occasionally drops the download. */
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function suggestedExportName(
    sourceName: string,
    format: ExportFormat,
): string {
    const base = sourceName.replace(/\.[^./\\]+$/, "") || "photo-export";
    return `${base}.${extensionFor(format)}`;
}
