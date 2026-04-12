/**
 * Tests for lib/generations.ts — R2 key construction.
 *
 * buildR2Key is critical: a malformed key means images get stored in
 * the wrong location, can't be retrieved, or collide with other users'
 * assets. These tests verify the key structure for every content type
 * and MIME type combination.
 */

import { describe, it, expect } from "vitest";
import { buildR2Key } from "@/lib/generations";

describe("buildR2Key", () => {
    it("builds correct key for WebP image", () => {
        const key = buildR2Key("user123", "proj456", "image", "gen789", "image/webp");
        expect(key).toBe("generation/user123/proj456/image/gen789.webp");
    });

    it("builds correct key for JPEG image", () => {
        const key = buildR2Key("user123", "proj456", "image", "gen789", "image/jpeg");
        expect(key).toBe("generation/user123/proj456/image/gen789.jpg");
    });

    it("builds correct key for PNG image", () => {
        const key = buildR2Key("user123", "proj456", "image", "gen789", "image/png");
        expect(key).toBe("generation/user123/proj456/image/gen789.png");
    });

    it("builds correct key for MP4 video", () => {
        const key = buildR2Key("user123", "proj456", "video", "gen789", "video/mp4");
        expect(key).toBe("generation/user123/proj456/video/gen789.mp4");
    });

    it("handles jpg in MIME type", () => {
        const key = buildR2Key("u", "p", "image", "g", "image/jpg");
        expect(key).toBe("generation/u/p/image/g.jpg");
    });

    it("defaults unknown MIME types to png", () => {
        const key = buildR2Key("u", "p", "image", "g", "image/tiff");
        expect(key).toBe("generation/u/p/image/g.png");
    });

    it("produces unique keys for different generations in same project", () => {
        const key1 = buildR2Key("user", "proj", "image", "gen1", "image/webp");
        const key2 = buildR2Key("user", "proj", "image", "gen2", "image/webp");
        expect(key1).not.toBe(key2);
    });

    it("produces unique keys for same generation in different projects", () => {
        const key1 = buildR2Key("user", "proj1", "image", "gen", "image/webp");
        const key2 = buildR2Key("user", "proj2", "image", "gen", "image/webp");
        expect(key1).not.toBe(key2);
    });

    it("produces unique keys for different users", () => {
        const key1 = buildR2Key("user1", "proj", "image", "gen", "image/webp");
        const key2 = buildR2Key("user2", "proj", "image", "gen", "image/webp");
        expect(key1).not.toBe(key2);
    });

    it("produces unique keys for image vs video of same generation", () => {
        const key1 = buildR2Key("user", "proj", "image", "gen", "image/webp");
        const key2 = buildR2Key("user", "proj", "video", "gen", "video/mp4");
        expect(key1).not.toBe(key2);
    });

    it("key starts with generation/ prefix", () => {
        const key = buildR2Key("u", "p", "image", "g", "image/webp");
        expect(key.startsWith("generation/")).toBe(true);
    });

    it("key contains no double slashes", () => {
        const key = buildR2Key("user", "proj", "image", "gen", "image/webp");
        expect(key).not.toContain("//");
    });
});
