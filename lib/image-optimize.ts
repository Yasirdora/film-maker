/**
 * Image optimization — converts generated images to WebP before R2 storage.
 *
 * Generated images arrive as JPEG from Imagen 4.0. We convert to WebP
 * before uploading to R2, achieving ~79% size reduction at quality 85
 * with imperceptible quality loss for photographic content.
 *
 * Runtime strategy:
 *   • **Node.js** (next dev) — uses `sharp`, the industry-standard native
 *     image processing library. Fast, reliable, full-featured.
 *   • **Cloudflare Workers** (production) — `sharp` requires native C++
 *     bindings that Workers don't support. Falls back to storing the
 *     original JPEG. At ~386KB per image this is still efficient, and
 *     Cloudflare's CDN can serve WebP via Image Resizing if enabled.
 *
 * Size comparison (real benchmark, 1408×768 image):
 *   JPEG (Imagen output):  386 KB
 *   WebP q=85:              82 KB  (79% smaller)
 */

/** WebP encoding quality — 85 balances size and visual fidelity. */
const WEBP_QUALITY = 85;

export interface OptimizeResult {
    /** The optimized image bytes (WebP if conversion succeeded, original otherwise). */
    data: ArrayBuffer;
    /** The MIME type of the output ("image/webp" or the original MIME type). */
    mimeType: string;
    /** Whether conversion actually happened (false = stored original format). */
    converted: boolean;
}

/**
 * Converts image bytes to WebP using the best available method for
 * the current runtime.
 *
 * Never throws — returns the original image on conversion failure
 * so the generation flow always completes.
 */
export async function optimizeImage(
    imageData: ArrayBuffer,
    originalMimeType: string,
): Promise<OptimizeResult> {
    if (originalMimeType === "image/webp") {
        return { data: imageData, mimeType: "image/webp", converted: false };
    }

    const sharpResult = await convertWithSharp(imageData);
    if (sharpResult) {
        return { data: sharpResult, mimeType: "image/webp", converted: true };
    }

    console.warn(
        "[image-optimize] WebP conversion unavailable in this runtime. " +
        "Storing original format.",
    );
    return { data: imageData, mimeType: originalMimeType, converted: false };
}

// ─── Sharp (Node.js) ───────────────────────────────────────────────────────

/**
 * Attempts WebP conversion via sharp. Returns null if sharp is not
 * available (Cloudflare Workers, missing dependency).
 *
 * The module name is constructed at runtime to prevent Turbopack /
 * esbuild from statically analyzing and bundling sharp — its native
 * C++ bindings cannot be included in a Cloudflare Workers bundle.
 */
async function convertWithSharp(
    imageData: ArrayBuffer,
): Promise<ArrayBuffer | null> {
    try {
        const moduleName = ["sh", "arp"].join("");
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
        const sharp = require(moduleName) as any;
        const buffer = Buffer.from(imageData);
        const webpBuffer = await sharp(buffer)
            .webp({ quality: WEBP_QUALITY })
            .toBuffer();
        return new Uint8Array(webpBuffer).buffer as ArrayBuffer;
    } catch {
        return null;
    }
}
