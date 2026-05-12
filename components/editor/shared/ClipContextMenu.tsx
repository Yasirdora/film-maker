"use client";

import { useCallback, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
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
        style={{
          minWidth: 220,
          background: "#161616",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12,
          padding: 4,
          boxShadow:
            "0 16px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
          color: "white",
          fontSize: 13,
          userSelect: "none",
          outline: "none",
        }}
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
  return (
    <div
      role="separator"
      style={{
        height: 1,
        margin: "4px 6px",
        background: "rgba(255,255,255,0.07)",
      }}
    />
  );
}

type CtxMenuItemProps = {
  onSelect?: (e: MouseEvent) => void;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
};

function CtxMenuItem({ onSelect, shortcut, disabled, danger, children }: CtxMenuItemProps) {
  const [hovered, setHovered] = useState(false);

  const color = disabled
    ? "rgba(255,255,255,0.3)"
    : danger
      ? "#ff453a"
      : "white";

  return (
    <button
      role="menuitem"
      type="button"
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onSelect}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        gap: 16,
        padding: "7px 10px",
        borderRadius: 7,
        border: "none",
        background: hovered ? "rgba(255,255,255,0.09)" : "transparent",
        color,
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        font: "inherit",
        fontSize: 13,
        outline: "none",
        transition: "background 0.08s",
        boxSizing: "border-box",
      }}
    >
      <span>{children}</span>
      {shortcut && (
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            letterSpacing: 0.3,
            color: danger
              ? "rgba(255, 80, 60, 0.6)"
              : "rgba(255,255,255,0.4)",
            flexShrink: 0,
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
}
