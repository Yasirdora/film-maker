/**
 * Tests for lib/utils.ts — UID generation and HTML escaping.
 *
 * generateUid is used for all public-facing identifiers (project UIDs,
 * generation UIDs, user profile UIDs). Collisions would cause data
 * corruption. escapeHtml prevents XSS in email templates.
 */

import { describe, it, expect } from "vitest";
import { generateUid, escapeHtml } from "@/lib/utils";

describe("generateUid", () => {
    it("generates string of requested length", () => {
        expect(generateUid(16)).toHaveLength(16);
        expect(generateUid(8)).toHaveLength(8);
        expect(generateUid(32)).toHaveLength(32);
    });

    it("uses only lowercase alphanumeric characters", () => {
        const uid = generateUid(100);
        expect(uid).toMatch(/^[0-9a-z]+$/);
    });

    it("generates unique values", () => {
        const uids = new Set(Array.from({ length: 1000 }, () => generateUid(16)));
        // With 82 bits of entropy, 1000 UIDs should all be unique.
        expect(uids.size).toBe(1000);
    });

    it("defaults to length 16", () => {
        expect(generateUid()).toHaveLength(16);
    });
});

describe("escapeHtml", () => {
    it("escapes ampersand", () => {
        expect(escapeHtml("a&b")).toBe("a&amp;b");
    });

    it("escapes angle brackets", () => {
        expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    });

    it("escapes quotes", () => {
        expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
        expect(escapeHtml("'hello'")).toBe("&#39;hello&#39;");
    });

    it("handles empty string", () => {
        expect(escapeHtml("")).toBe("");
    });

    it("leaves safe strings unchanged", () => {
        expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
    });

    it("escapes all dangerous characters in combination", () => {
        expect(escapeHtml('<img onerror="alert(1)" src=\'x\'>&')).toBe(
            "&lt;img onerror=&quot;alert(1)&quot; src=&#39;x&#39;&gt;&amp;",
        );
    });
});
