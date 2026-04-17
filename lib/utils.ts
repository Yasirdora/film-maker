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
 * Returns true if the URL points to a video file we serve (mp4/webm/mov).
 * Used by gallery + project-card cover rendering to pick between
 * `<img>` and `<video>` without a server-side kind lookup.
 */
export function isVideoUrl(url: string): boolean {
    return /\.(mp4|webm|mov)(\?|#|$)/i.test(url);
}

/**
 * Formats an image + video count pair into a human label for project cards.
 *   (0, 0)  → "Empty"
 *   (9, 0)  → "9 images"
 *   (0, 3)  → "3 videos"
 *   (9, 3)  → "9 images · 3 videos"
 */
export function formatContentCount(images: number, videos: number): string {
    if (images === 0 && videos === 0) return "Empty";
    const parts: string[] = [];
    if (images > 0) parts.push(`${images} image${images !== 1 ? "s" : ""}`);
    if (videos > 0) parts.push(`${videos} video${videos !== 1 ? "s" : ""}`);
    return parts.join(" · ");
}

/**
 * Humanized "time ago" string for a Unix-ms timestamp — e.g. "3m ago",
 * "2d ago", "Apr 12". Shared between the studio card, archived list,
 * and anywhere else we show relative times in the UI.
 */
export function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
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
