"use client";

/**
 * Video editor page-bar actions: composes the shared editor toolbar with
 * video-flavored copy. The tool row, undo/redo pair, and Export button
 * live in `components/shared/EditorPageActions.tsx`.
 */

import { useCallback, useRef, useState } from "react";

import { useEditor } from "@/lib/editor/store";
import { useIsMobile } from "@/lib/editor/useMediaQuery";
import {
  EditorExportButton,
  EditorToolButtons,
  EditorUndoRedo,
} from "@/components/editor/shared/EditorPageActions";
import Popover from "@/components/editor/shared/Popover";

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

/* ─── Canvas size dropdown ────────────────────────────────────────────── */

/**
 * Standard canvas dimensions offered by the dropdown. Order matches the
 * editor's "obvious first" sequence: landscape → portrait → square →
 * variants. Add new entries here, the dropdown picks them up automatically.
 */
type CanvasOption = {
  label: string;
  ratio: string;
  width: number;
  height: number;
};

const CANVAS_OPTIONS: readonly CanvasOption[] = [
  { label: "Landscape", ratio: "16:9", width: 1920, height: 1080 },
  { label: "Portrait",  ratio: "9:16", width: 1080, height: 1920 },
  { label: "Square",    ratio: "1:1",  width: 1080, height: 1080 },
  { label: "Standard",  ratio: "4:3",  width: 1440, height: 1080 },
  { label: "Vertical",  ratio: "4:5",  width: 1080, height: 1350 },
  { label: "Cinema",    ratio: "21:9", width: 2560, height: 1080 },
];

/**
 * Canvas-size control — anchored dropdown that lets the user switch
 * between the standard aspect ratios. Selection writes back through the
 * editor store's `setCanvas`. This is the only in-editor surface for
 * canvas dimensions; the landing page opens straight into the editor on
 * the canonical 16:9 default, and users change it here.
 */
export function VideoEditorCanvasButton() {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const canvas = useEditor((s) => s.canvas);
  const setCanvas = useEditor((s) => s.setCanvas);

  const close = useCallback(() => setOpen(false), []);

  const handleSelect = useCallback(
    (option: CanvasOption) => {
      setCanvas({ width: option.width, height: option.height });
      close();
    },
    [setCanvas, close],
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Change canvas size"
        aria-label="Change canvas size"
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] font-medium text-white/80 hover:text-white hover:bg-white/[0.06] data-[active]:bg-white/[0.06] transition-colors"
        data-active={open || undefined}
      >
        <CanvasGlyph />
        <span className="hidden sm:inline tabular-nums">
          {canvas.width}×{canvas.height}
        </span>
        <ChevronGlyph open={open} />
      </button>

      <Popover
        open={open}
        anchorRef={triggerRef}
        onClose={close}
        offset={6}
        placement="bottom-end"
      >
        <CanvasMenu current={canvas} onSelect={handleSelect} />
      </Popover>
    </>
  );
}

function CanvasMenu({
  current,
  onSelect,
}: {
  current: { width: number; height: number };
  onSelect: (option: CanvasOption) => void;
}) {
  return (
    <div
      role="menu"
      className="min-w-[220px] rounded-xl p-1 shadow-[0_16px_40px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]"
      style={{
        backgroundColor: "#161616",
        border: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      {CANVAS_OPTIONS.map((option) => {
        const selected =
          option.width === current.width && option.height === current.height;
        return (
          <button
            key={option.label}
            role="menuitemradio"
            aria-checked={selected}
            type="button"
            onClick={() => onSelect(option)}
            className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
              selected ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
            }`}
          >
            <RatioPreview width={option.width} height={option.height} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-white leading-tight">
                {option.label}
              </div>
              <div className="text-[11px] text-[#8e8e93] leading-tight">
                {option.ratio} · {option.width}×{option.height}
              </div>
            </div>
            {selected && <CheckGlyph />}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Glyphs ──────────────────────────────────────────────────────────── */

/** 20px-square preview of a ratio, scaled so the longest side fills the box. */
function RatioPreview({ width, height }: { width: number; height: number }) {
  const BOX = 20;
  const ratio = width / height;
  const w = ratio >= 1 ? BOX : BOX * ratio;
  const h = ratio >= 1 ? BOX / ratio : BOX;
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center"
      style={{ width: BOX, height: BOX }}
    >
      <div
        className="rounded-[2px]"
        style={{
          width: w,
          height: h,
          backgroundColor: "#27292c",
          border: "1px solid rgba(255,255,255,0.18)",
        }}
      />
    </div>
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

function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-white"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
