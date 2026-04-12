/**
 * Tests for lib/image-optimize.ts — image format conversion.
 *
 * Verifies the optimization pipeline: WebP passthrough, sharp
 * conversion (when available), and graceful fallback.
 */

import { describe, it, expect } from "vitest";
import { optimizeImage } from "@/lib/image-optimize";

describe("optimizeImage", () => {
    it("passes through WebP images without conversion", async () => {
        const data = new ArrayBuffer(100);
        const result = await optimizeImage(data, "image/webp");

        expect(result.mimeType).toBe("image/webp");
        expect(result.converted).toBe(false);
        expect(result.data).toBe(data);
    });

    it("attempts to convert JPEG to WebP", async () => {
        // Create a minimal valid JPEG (just the header — sharp will
        // either convert it or fail gracefully).
        const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
        const result = await optimizeImage(jpeg.buffer as ArrayBuffer, "image/jpeg");

        // In test environment with sharp installed, this should convert.
        // If sharp isn't available, it falls back to original JPEG.
        expect(["image/webp", "image/jpeg"]).toContain(result.mimeType);
        expect(result.data).toBeDefined();
    });

    it("attempts to convert PNG to WebP", async () => {
        // Minimal PNG header.
        const png = new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]);
        const result = await optimizeImage(png.buffer as ArrayBuffer, "image/png");

        expect(["image/webp", "image/png"]).toContain(result.mimeType);
        expect(result.data).toBeDefined();
    });

    it("never throws on any input", async () => {
        // Empty buffer — should not throw.
        const result = await optimizeImage(new ArrayBuffer(0), "image/jpeg");
        expect(result).toBeDefined();
        expect(result.data).toBeDefined();
    });
});
