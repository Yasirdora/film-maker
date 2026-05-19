"use client";

/**
 * Video editor page-bar actions: composes the shared editor toolbar
 * with video-flavored copy and re-exports the video-specific canvas
 * dropdown.
 *
 * The tool row, undo/redo pair, and Export button live in
 * `components/editor/shared/EditorPageActions.tsx`; the canvas dropdown
 * lives in `components/editor/shared/CanvasSizeButton.tsx`. This file
 * is the thin glue between those shared parts and the video route.
 */

import { useIsMobile } from "@/lib/editor/useMediaQuery";
import { EditorToolButtons } from "@/components/editor/shared/EditorPageActions";
import CanvasSizeButton from "@/components/editor/shared/CanvasSizeButton";

/**
 * Disabled-state tooltip used wherever the video editor blocks an
 * action because no media is loaded yet. Single string so the copy
 * doesn't drift between surfaces.
 */
export const NO_VIDEO_MEDIA_TITLE = "Add video to enable";

/** Mobile-friendly tool row shared between the PageBar and the bottom dock. */
export function VideoEditorToolButtons({
  menuPlacement = "down",
}: {
  menuPlacement?: "up" | "down";
}) {
  return (
    <EditorToolButtons
      menuPlacement={menuPlacement}
      noMediaTitle={NO_VIDEO_MEDIA_TITLE}
    />
  );
}

/** Desktop tool row in the PageBar; hidden on mobile (lives in the bottom dock). */
export default function VideoEditorPageActions() {
  const isMobile = useIsMobile();
  if (isMobile) return null;
  return (
    <div className="ml-2 sm:ml-3">
      <VideoEditorToolButtons menuPlacement="down" />
    </div>
  );
}

/**
 * Re-exported so the mount can reach for one canonical "video canvas
 * picker" symbol without touching the shared component directly.
 * Kept as a function for symmetry with `VideoEditorPageActions` —
 * future per-video customisation (e.g. surfacing the underlying source
 * dimensions inline) lands here without rippling through the mount.
 */
export function VideoEditorCanvasButton() {
  return <CanvasSizeButton />;
}
