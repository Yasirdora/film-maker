"use client";

/**
 * Video editor page-bar actions: composes the shared editor toolbar with
 * video-flavored copy. The tool row, undo/redo pair, and Export button
 * live in `components/shared/EditorPageActions.tsx`.
 */

import { useIsMobile } from "@/lib/editor/useMediaQuery";
import {
  EditorExportButton,
  EditorToolButtons,
  EditorUndoRedo,
} from "@/components/editor/shared/EditorPageActions";

const NO_MEDIA_TITLE = "Add video to enable";

/** Mobile-friendly tool row shared between the PageBar and the bottom dock. */
export function VideoEditorToolButtons({
  menuPlacement = "down",
}: {
  menuPlacement?: "up" | "down";
}) {
  return (
    <EditorToolButtons
      menuPlacement={menuPlacement}
      noMediaTitle={NO_MEDIA_TITLE}
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

export function VideoEditorUndoRedo() {
  return <EditorUndoRedo />;
}

export function VideoEditorExport() {
  return <EditorExportButton noMediaTitle="Add video to enable export" />;
}
