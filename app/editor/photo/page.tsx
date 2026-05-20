/**
 * /editor/photo — Photo editor route entry.
 *
 * Browser-side image editor mounted client-side from a hoisted dynamic
 * import (see `PhotoEditorMount`). Public route — no auth guard, no
 * server-side image processing. Files never leave the user's device.
 *
 * Scaffold version (v1): load an image, view it on the canvas, export
 * to PNG / JPEG / WebP. Edits (crop, adjustments, filters) land in
 * focused follow-up passes that share this same Mount pattern.
 */

import type { Metadata } from "next";
import PhotoEditorClient from "./PhotoEditorClient";

export const metadata: Metadata = {
    title: "Photo Editor",
    description:
        "Browser-side photo editor — load, view, and export images. Files never leave your device.",
};

export default function PhotoEditorPage() {
    return <PhotoEditorClient />;
}

