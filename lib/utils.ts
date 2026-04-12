/**
 * Small shared utilities. Keep this file tiny — anything with more than a
 * handful of helpers should get its own module.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind-aware class name builder. Combines conditional classnames and
 * de-duplicates conflicting Tailwind utilities ("p-2 p-4" -> "p-4").
 */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

/**
 * Generates a short, URL-safe, opaque identifier.
 *
 * Uses a 36-char alphabet (0-9 + a-z) with cryptographically random bytes.
 * Modulo bias across 256 → 36 is negligible for non-cryptographic ids.
 *
 * Default length 16 gives ~82 bits of entropy — comfortably collision-free
 * at our scale.
 */
const UID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function generateUid(length = 16): string {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    let out = "";
    for (let i = 0; i < length; i++) {
        out += UID_ALPHABET[bytes[i] % UID_ALPHABET.length];
    }
    return out;
}

/**
 * HTML-escapes a string for safe interpolation into email templates.
 * Small dedicated helper so we never pull in a full sanitizer for the
 * handful of fields we interpolate (names, codes).
 */
export function escapeHtml(input: string): string {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
