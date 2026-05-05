/**
 * Base64 encode/decode utilities — single source of truth.
 *
 * These helpers work in both the browser and Cloudflare Workers (both
 * expose the global `atob` / `btoa` functions). Node.js also supports
 * them since v16.
 *
 * `arrayBufferToBase64` uses a chunked approach to avoid a stack-overflow
 * when calling `String.fromCharCode(...largeArray)` — the spread operator
 * hits the call-stack limit for buffers larger than ~64 KB on some runtimes.
 */

/**
 * Decodes a base64 string to a `Uint8Array`.
 * Safe for arbitrary-length inputs.
 */
export function base64ToBytes(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

/**
 * Encodes an `ArrayBuffer` (or any `ArrayBufferLike`) to a base64 string.
 * Processes in 32 KB chunks to avoid call-stack limits on large buffers.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000; // 32 KB
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

/**
 * Encodes a byte array to base64url (RFC 4648 §5) — the URL-safe variant
 * used by JWTs. No padding, `-` instead of `+`, `_` instead of `/`.
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
    const base64 = arrayBufferToBase64(
        bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
    );
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
