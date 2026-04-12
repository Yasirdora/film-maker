/**
 * Tests for lib/security.ts — CSRF origin validation.
 *
 * Origin validation is the first line of defense against cross-site
 * request forgery. A bypass here would allow malicious sites to
 * trigger generations, purchases, or data mutations on behalf of
 * authenticated users.
 */

import { describe, it, expect } from "vitest";
import { validateOrigin } from "@/lib/security";

function makeRequest(origin: string | null): Request {
    const headers = new Headers();
    if (origin) headers.set("origin", origin);
    return new Request("https://film-maker.net/api/generate", {
        method: "POST",
        headers,
    });
}

describe("validateOrigin", () => {
    it("allows production origin", () => {
        expect(validateOrigin(makeRequest("https://film-maker.net"))).toBeNull();
    });

    it("allows www production origin", () => {
        expect(validateOrigin(makeRequest("https://www.film-maker.net"))).toBeNull();
    });

    it("allows localhost:3000", () => {
        expect(validateOrigin(makeRequest("http://localhost:3000"))).toBeNull();
    });

    it("allows localhost:3001", () => {
        expect(validateOrigin(makeRequest("http://localhost:3001"))).toBeNull();
    });

    it("allows localhost:3002", () => {
        expect(validateOrigin(makeRequest("http://localhost:3002"))).toBeNull();
    });

    it("rejects missing origin", () => {
        const result = validateOrigin(makeRequest(null));
        expect(result).not.toBeNull();
        expect(result!.status).toBe(403);
    });

    it("rejects untrusted origin", () => {
        const result = validateOrigin(makeRequest("https://evil.com"));
        expect(result).not.toBeNull();
        expect(result!.status).toBe(403);
    });

    it("rejects http version of production domain", () => {
        const result = validateOrigin(makeRequest("http://film-maker.net"));
        expect(result).not.toBeNull();
        expect(result!.status).toBe(403);
    });

    it("rejects subdomain spoofing", () => {
        const result = validateOrigin(makeRequest("https://evil.film-maker.net"));
        expect(result).not.toBeNull();
        expect(result!.status).toBe(403);
    });

    it("rejects origin with path", () => {
        const result = validateOrigin(makeRequest("https://film-maker.net/some-path"));
        expect(result).not.toBeNull();
        expect(result!.status).toBe(403);
    });
});
