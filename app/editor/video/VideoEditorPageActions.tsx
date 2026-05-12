"use client";

/**
 * Video editor page-bar actions: composes the shared editor toolbar with
 * video-flavored copy. The tool row, undo/redo pair, and Export button
 * live in `components/shared/EditorPageActions.tsx`.
 */

import { useState } from "react";

import { useEditor } from "@/lib/editor/store";
import { useIsMobile } from "@/lib/editor/useMediaQuery";
import {
  EditorExportButton,
  EditorToolButtons,
  EditorUndoRedo,
} from "@/components/editor/shared/EditorPageActions";
import CanvasSizeModal from "@/components/editor/CanvasSizeModal";

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

/**
 * Canvas-size control — opens a modal that lets the user switch between
 * the standard aspect ratios (16:9, 9:16, 1:1, 4:3, 4:5, 21:9) and writes
 * the selection back through the editor store's `setCanvas`. This is the
 * only in-editor surface for canvas dimensions; the landing page no
 * longer prompts for a size, so the editor opens in the canonical 16:9
 * default and users can change it here.
 */
export function VideoEditorCanvasButton() {
  const [open, setOpen] = useState(false);
  const canvas = useEditor((s) => s.canvas);
  const setCanvas = useEditor((s) => s.setCanvas);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Change canvas size"
        aria-label="Change canvas size"
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] font-medium text-white/80 hover:text-white hover:bg-white/[0.06] transition-colors"
      >
        <CanvasGlyph />
        <span className="hidden sm:inline tabular-nums">
          {canvas.width}×{canvas.height}
        </span>
      </button>
      <CanvasSizeModal
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(width, height) => setCanvas({ width, height })}
        title="Change canvas size"
        confirmLabel="Apply"
        current={{ width: canvas.width, height: canvas.height }}
      />
    </>
  );
}

function CanvasGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
    </svg>
  );
}
