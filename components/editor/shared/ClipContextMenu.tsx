"use client";

import { useCallback, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import ContextMenuPortal from "./ContextMenuPortal";
import ColorSwatchRow from "./ColorSwatchRow";
import { useEditor } from "@/lib/editor/store";
import { clock } from "@/lib/editor/clock";

/* ── Platform-aware shortcut labels ────────────────────────────────── */

const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const MOD = IS_MAC ? "⌘" : "Ctrl+";

/* ── Component ─────────────────────────────────────────────────────── */

export type ClipContextMenuProps = {
  clipId: string;
  x: number;
  y: number;
  onClose: () => void;
};

/**
 * Right-click context menu for a timeline clip.
 *
 * Reads all state from the store internally — the parent only provides
 * the clip id and cursor coordinates.
 */
export default function ClipContextMenu({ clipId, x, y, onClose }: ClipContextMenuProps) {
  const clip = useEditor((s) => s.clips[clipId]);
  const hasClipboard = useEditor((s) => s._clipboard !== null);

  const copyClip = useEditor((s) => s.copyClip);
  const cutClip = useEditor((s) => s.cutClip);
  const pasteClip = useEditor((s) => s.pasteClip);
  const duplicateClip = useEditor((s) => s.duplicateClip);
  const removeClip = useEditor((s) => s.removeClip);
  const splitSelectedAtPlayhead = useEditor((s) => s.splitSelectedAtPlayhead);
  const setSelectedClip = useEditor((s) => s.setSelectedClip);
  const toggleClipDisabled = useEditor((s) => s.toggleClipDisabled);
  const setClipColor = useEditor((s) => s.setClipColor);
  const showVolumeEnvelopes = useEditor((s) => s.showVolumeEnvelopes);
  const toggleVolumeEnvelopes = useEditor((s) => s.toggleVolumeEnvelopes);

  /* Ensure this clip is selected so clipboard/split actions target it. */
  const ensureSelected = useCallback(() => {
    if (useEditor.getState().selectedClipId !== clipId) {
      setSelectedClip(clipId);
    }
  }, [clipId, setSelectedClip]);

  const act = useCallback(
    (fn: () => void) => (e: MouseEvent) => {
      e.stopPropagation();
      ensureSelected();
      fn();
      onClose();
    },
    [ensureSelected, onClose],
  );

  /* Is the playhead within this clip's bounds? */
  const playheadInClip =
    clip &&
    clock.time() > clip.start + 0.05 &&
    clock.time() < clip.start + clip.duration - 0.05;

  /* Trap Tab/Shift+Tab inside the menu. */
  const onMenuKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>(
        "[role='menuitem']:not([aria-disabled])",
      ),
    );
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey
      ? (idx - 1 + items.length) % items.length
      : (idx + 1) % items.length;
    items[next].focus();
  }, []);

  if (!clip) return null;

  const isDisabled = clip.disabled;

  return (
    <ContextMenuPortal open x={x} y={y} onClose={onClose}>
      <div
        role="menu"
        onKeyDown={onMenuKeyDown}
        className="ui-menu"
        style={{ minWidth: 220 }}
      >
        {/* ── Edit ── */}
        <CtxMenuItem onSelect={act(cutClip)} shortcut={`${MOD}X`}>
          Cut
        </CtxMenuItem>
        <CtxMenuItem onSelect={act(copyClip)} shortcut={`${MOD}C`}>
          Copy
        </CtxMenuItem>
        <CtxMenuItem onSelect={act(pasteClip)} shortcut={`${MOD}V`} disabled={!hasClipboard}>
          Paste
        </CtxMenuItem>
        <CtxMenuItem onSelect={act(duplicateClip)} shortcut={`${MOD}D`}>
          Duplicate
        </CtxMenuItem>
        
        {clip.kind !== "text" && clip.kind !== "image" && (
          <CtxMenuItem onSelect={act(() => useEditor.getState().reverseClip(clipId))}>
            Reverse
          </CtxMenuItem>
        )}

        <CtxDivider />

        {/* ── Clip actions ── */}
        <CtxMenuItem
          onSelect={act(splitSelectedAtPlayhead)}
          shortcut="K"
          disabled={!playheadInClip}
        >
          Split at Playhead
        </CtxMenuItem>

        <CtxDivider />

        {/* ── Color ── */}
        <ColorSwatchRow
          value={clip.color}
          onChange={(hex) => {
            ensureSelected();
            setClipColor(clipId, hex);
            onClose();
          }}
          ariaLabel="Clip color"
        />

        <CtxDivider />

        {/* ── State toggles ── */}
        <CtxMenuItem onSelect={act(() => toggleClipDisabled(clipId))}>
          {isDisabled ? "Enable" : "Disable"}
        </CtxMenuItem>

        <CtxMenuItem onSelect={act(toggleVolumeEnvelopes)}>
          {showVolumeEnvelopes ? "Hide volume envelope" : "Show volume envelope"}
        </CtxMenuItem>

        <CtxDivider />

        {/* ── Destructive ── */}
        <CtxMenuItem
          onSelect={act(() => removeClip(clipId))}
          shortcut="⌫"
          danger
        >
          Delete
        </CtxMenuItem>
      </div>
    </ContextMenuPortal>
  );
}

/* ── Primitives — styled identically to TrackKebabMenu ─────────────── */

function CtxDivider() {
  return <div role="separator" className="ui-menu-divider" />;
}

type CtxMenuItemProps = {
  onSelect?: (e: MouseEvent) => void;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
};

function CtxMenuItem({ onSelect, shortcut, disabled, danger, children }: CtxMenuItemProps) {
  return (
    <button
      role="menuitem"
      type="button"
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onSelect}
      className={`ui-menu-item${danger ? " ui-menu-item-danger" : ""}`}
    >
      <span>{children}</span>
      {shortcut && (
        <span className="ui-menu-shortcut" style={{ fontFamily: "monospace", fontSize: 11 }}>
          {shortcut}
        </span>
      )}
    </button>
  );
}
