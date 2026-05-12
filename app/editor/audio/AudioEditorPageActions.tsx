"use client";

/**
 * Audio editor page-bar actions: composes the shared editor toolbar with
 * audio-flavored copy ("Add audio to enable") plus an audio-only kebab
 * menu (volume envelopes toggle + keyboard shortcuts).
 *
 * The tool row, undo/redo pair, and Export button live in
 * `components/shared/EditorPageActions.tsx` so the video editor reuses
 * them with its own copy.
 */

import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/lib/editor/store";
import { useIsMobile } from "@/lib/editor/useMediaQuery";
import {
  EditorExportButton,
  EditorToolButtons,
  EditorUndoRedo,
} from "@/components/editor/shared/EditorPageActions";

const NO_MEDIA_TITLE = "Add audio to enable";

/** Mobile-friendly tool row shared between the PageBar and the bottom dock. */
export function AudioEditorToolButtons({
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

/**
 * Compact toolbar shown inside `<PageBar>` for the audio editor. On mobile
 * the same buttons live in the bottom MobileEditingBar (thumb-reachable),
 * so they're hidden here to avoid duplication.
 */
export default function AudioEditorPageActions() {
  const isMobile = useIsMobile();
  if (isMobile) return null;
  return (
    <div className="ml-2 sm:ml-3">
      <AudioEditorToolButtons menuPlacement="down" />
    </div>
  );
}

/** Re-exports for the audio mount; kept tiny so callers stay readable. */
export function AudioEditorUndoRedo() {
  return <EditorUndoRedo />;
}

export function AudioEditorExport() {
  return <EditorExportButton noMediaTitle="Add audio to enable export" />;
}

/* ── Project-actions kebab — audio-only (volume envelopes toggle) ────── */

/**
 * Project-actions kebab shown immediately after the BETA badge in the
 * PageBar's `leadingActions` slot. Mirrors the menu items in the desktop
 * toolbar's kebab (volume envelopes toggle + keyboard shortcuts) so both
 * surfaces stay in sync — both read the same store state.
 */
export function AudioEditorKebab() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const showVolumeEnvelopes = useEditor((s) => s.showVolumeEnvelopes);
  const toggleVolumeEnvelopes = useEditor((s) => s.toggleVolumeEnvelopes);
  const setShowHelp = useEditor((s) => s.setShowHelp);
  const hasMedia = useEditor((s) => s.clipOrder.length > 0);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Project menu"
        aria-label="Project menu"
        className="w-7 h-7 rounded-md inline-flex items-center justify-center transition-colors hover:bg-white/[0.06]"
        style={{
          color: open ? "#ffffff" : "rgba(255,255,255,0.55)",
          backgroundColor: open ? "rgba(255,255,255,0.06)" : "transparent",
        }}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute left-0 top-full mt-1.5 z-30"
          style={{
            minWidth: 200,
            background: "rgba(30, 30, 30, 0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: 10,
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6)",
            padding: 4,
          }}
        >
          <KebabMenuItem
            label="Volume envelopes"
            checked={showVolumeEnvelopes}
            disabled={!hasMedia}
            onClick={() => { toggleVolumeEnvelopes(); setOpen(false); }}
          />
          <KebabMenuDivider />
          <KebabMenuItem
            label="Keyboard shortcuts"
            shortcut="?"
            onClick={() => { setShowHelp(true); setOpen(false); }}
          />
        </div>
      )}
    </div>
  );
}

function KebabMenuItem({
  label,
  shortcut,
  checked,
  disabled = false,
  onClick,
}: {
  label: string;
  shortcut?: string;
  checked?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? NO_MEDIA_TITLE : undefined}
      className="ae-menu-item disabled:cursor-not-allowed"
      style={{ fontSize: 13, opacity: disabled ? 0.4 : 1 }}
    >
      <div className="flex items-center gap-2">
        {checked !== undefined && (
          <span
            style={{
              width: 14,
              fontSize: 13,
              color: checked ? "rgba(255, 255, 255, 0.9)" : "transparent",
            }}
          >
            ✓
          </span>
        )}
        <span>{label}</span>
      </div>
      {shortcut && <span className="ae-menu-shortcut">{shortcut}</span>}
    </button>
  );
}

function KebabMenuDivider() {
  return (
    <div
      style={{
        height: 1,
        background: "rgba(255, 255, 255, 0.06)",
        margin: "4px 0",
      }}
    />
  );
}
