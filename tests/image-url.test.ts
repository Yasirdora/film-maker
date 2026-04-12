/**
 * Tests for lib/image-url.ts — URL construction for R2 objects.
 *
 * Verifies that image URLs are correctly constructed for both
 * development (local proxy) and production (R2 custom domain)
 * environments.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { getImageUrl } from "@/lib/image-url";

describe("getImageUrl", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("returns local proxy URL in development", () => {
        vi.stubEnv("NODE_ENV", "development");
        const url = getImageUrl("generation/user/proj/image/gen.webp");
        expect(url).toBe("/api/storage/generation/user/proj/image/gen.webp");
    });

    it("returns R2 domain URL in production", () => {
        vi.stubEnv("NODE_ENV", "production");
        const url = getImageUrl("generation/user/proj/image/gen.webp");
        expect(url).toBe(
            "https://storage.film-maker.net/generation/user/proj/image/gen.webp",
        );
    });

    it("preserves full key path", () => {
        vi.stubEnv("NODE_ENV", "production");
        const key = "generation/abc123/def456/image/ghi789.jpg";
        const url = getImageUrl(key);
        expect(url).toContain(key);
    });
});
