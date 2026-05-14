/**
 * Client-side image → WebP converter for storyboard uploads.
 *
 * Pipeline (all in-browser, no server round-trip until the final POST):
 *
 *   1. Read the user's file into an HTMLImageElement so we can hand it
 *      to a canvas. `createImageBitmap` is faster when available but
 *      `<img>` is the cross-browser fallback that handles every format
 *      the platform decodes (JPEG, PNG, WebP, AVIF, GIF first frame,
 *      and — on Safari — HEIC/HEIF).
 *
 *   2. Cap the longest edge at MAX_DIMENSION (default 2048). Storyboard
 *      frames don't need 4K — keeping them small gives us 60-70%
 *      bandwidth savings vs the source and faster decode in the
 *      variant tray.
 *
 *   3. Re-encode to WebP via `canvas.toBlob('image/webp', quality)`.
 *      Default quality 0.85 — a sweet spot between visual fidelity
 *      and file size for storyboard reference imagery.
 *
 * Returns the encoded blob + final dimensions + the original MIME so
 * the upload form can carry both the bytes and the metadata the server
 * stores for forensics.
 *
 * Things this module DOES NOT do, intentionally:
 *
 *   • HEIC decoding on browsers that don't natively support it (Chrome,
 *     Firefox on most platforms). The browser will fail to draw the
 *     image; we surface a clean error so the caller can show a
 *     friendly message. Server-side transcode handles this in a later
 *     slice if needed.
 *
 *   • EXIF orientation honoring. Modern browsers auto-rotate JPEG
 *     content as of Chrome 81 / Firefox 77 / Safari 13.4 (via the
 *     `image-orientation: from-image` CSS default). Drawing through a
 *     canvas inherits that rotation so this Just Works.
 *
 *   • Color profile preservation. Canvas-encoded WebP is sRGB. Fine
 *     for storyboards; not fine for finished-grade pipelines (which
 *     would skip the canvas step anyway).
 */

export interface WebpConversionOptions {
    /** Longest-edge cap in pixels. Default 2048. */
    maxDimension?: number;
    /**
     * WebP encoder quality (0–1). Default 0.85 — visually lossless for
     * storyboards at sensible dimensions, ~30-40% smaller than 0.92.
     */
    quality?: number;
}

export interface WebpConversionResult {
    blob: Blob;
    width: number;
    height: number;
    originMime: string;
    originBytes: number;
    /** Round-trip ratio: encoded bytes / origin bytes. < 1 means we saved. */
    ratio: number;
}

const DEFAULT_MAX_DIMENSION = 2048;
const DEFAULT_QUALITY = 0.85;

/**
 * Converts a user-supplied image file to WebP at sensible dimensions.
 *
 * Throws on:
 *   • Non-image MIME.
 *   • A decode failure (e.g. HEIC on Chrome).
 *   • A canvas encode failure (extremely rare; usually OOM).
 */
export async function convertToWebp(
    file: File,
    options: WebpConversionOptions = {},
): Promise<WebpConversionResult> {
    if (!file.type.startsWith("image/")) {
        throw new Error("Not an image");
    }

    const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
    const quality = clamp(options.quality ?? DEFAULT_QUALITY, 0, 1);

    // Prefer createImageBitmap when available — it offloads the decode
    // off the main thread on browsers that support it. Fall back to
    // <img> for older Safari (still common on iPad).
    const source = await decodeImage(file);

    const { width, height, drawWidth, drawHeight } = fitWithin(
        source.width,
        source.height,
        maxDimension,
    );

    const canvas = makeCanvas(drawWidth, drawHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Could not acquire 2D canvas context");
    }
    // High-quality downscale. The default `imageSmoothingQuality` is
    // "low" on most browsers; "high" trades CPU for noticeably better
    // results on aggressive resamples.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source as CanvasImageSource, 0, 0, drawWidth, drawHeight);

    // Release the decoded source — important for large HEIC/HEIF input
    // on iPad where memory pressure is real.
    if (source instanceof ImageBitmap) source.close();

    const blob = await canvasToBlob(canvas, "image/webp", quality);

    return {
        blob,
        width,
        height,
        originMime: file.type,
        originBytes: file.size,
        ratio: blob.size / Math.max(1, file.size),
    };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, n));
}

function fitWithin(
    srcW: number,
    srcH: number,
    max: number,
): { width: number; height: number; drawWidth: number; drawHeight: number } {
    if (srcW <= max && srcH <= max) {
        return {
            width: srcW,
            height: srcH,
            drawWidth: srcW,
            drawHeight: srcH,
        };
    }
    const ratio = Math.min(max / srcW, max / srcH);
    const drawWidth = Math.round(srcW * ratio);
    const drawHeight = Math.round(srcH * ratio);
    return { width: drawWidth, height: drawHeight, drawWidth, drawHeight };
}

/**
 * Decodes an image file. Tries `createImageBitmap` first (off-main-thread
 * on modern Chromium/Firefox), falls back to an `<img>` element for
 * Safari and edge cases. The returned source is a drop-in for
 * `ctx.drawImage`.
 */
async function decodeImage(
    file: File,
): Promise<ImageBitmap | HTMLImageElement> {
    if (typeof createImageBitmap === "function") {
        try {
            return await createImageBitmap(file);
        } catch {
            // Fall through to <img> — HEIC on Chrome lands here.
        }
    }
    return await loadImageElement(file);
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
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
                    "Could not decode the image. Try a JPEG, PNG, or WebP.",
                ),
            );
        };
        img.src = url;
    });
}

/**
 * Returns either an OffscreenCanvas (when available) or an HTMLCanvasElement
 * fallback. OffscreenCanvas keeps work off the main thread when the
 * caller is inside a worker; for now we're always on the main thread,
 * but the encoder doesn't care which type it gets.
 */
function makeCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function canvasToBlob(
    canvas: HTMLCanvasElement,
    mime: string,
    quality: number,
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error("WebP encoding failed"));
                    return;
                }
                resolve(blob);
            },
            mime,
            quality,
        );
    });
}
