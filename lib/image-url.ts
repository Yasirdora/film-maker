/**
 * Image URL construction.
 *
 * Maps R2 object keys to public URLs. Images are stored as optimized
 * WebP in R2 (~82KB per generation), so no CDN-level transformation
 * is needed — we serve the stored file directly.
 *
 * URL structure:
 *   https://storage.film-maker.net/generation/{userUid}/{projectUid}/image/{generationUid}.webp
 *
 * Dev uses a local proxy route since the R2 custom domain isn't
 * available in the local miniflare environment.
 */

import { R2_STORAGE_BASE_URL } from "./constants";

/**
 * Returns the public URL for an R2 object key.
 *
 *   Dev:  /api/storage/{r2Key}
 *   Prod: https://storage.film-maker.net/{r2Key}
 */
export function getImageUrl(r2Key: string): string {
    if (process.env.NODE_ENV === "development") {
        return `/api/storage/${r2Key}`;
    }
    return `${R2_STORAGE_BASE_URL}/${r2Key}`;
}
