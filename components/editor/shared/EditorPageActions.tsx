"use client";

/**
 * Mode-agnostic page-bar actions shared between every editor:
 *
 *   • <EditorToolButtons>  — select/range/hand long-press menu, blade,
 *                            split-at-playhead, split-at-loop, snap toggle
 *   • <EditorUndoRedo>     — paired undo/redo buttons
 *   • <EditorExportButton> — primary "Export" pill
 *
 * Per-editor wrappers (AudioEditorPageActions, VideoEditorPageActions) pass
 * a `noMediaTitle` string so disabled-state tooltips read in domain language
 * ("Add audio to enable" vs "Add video to enable") without the components
 * caring what the editor edits.
 */

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useEditor } from "@/lib/editor/store";
import type { EditorMode } from "@/lib/editor/types";
import {
  ArrowSelectorTool,
  ContentCut,
  Magnet,
  PanTool,
  RangeTool,
  Redo,
  SplitAtLoop,
  SplitAtPlayhead,
  Undo,
} from "./icons";

/* ── Tool row ────────────────────────────────────────────────────────── */

export type EditorToolButtonsProps = {
  /** Where the long-press dropdown opens — desktop bar = "down", mobile dock = "up". */
  menuPlacement?: "up" | "down";
  /** Disabled-state tooltip / aria-disabled hint, e.g. "Add audio to enable". */
  noMediaTitle?: string;
};

/**
 * Row of editing tools, left → right:
 *   select · range · hand │ cut │ split · split-at-loop │ magnet
 *
 * Reads everything from the store, so the parent only chooses placement.
 */
export function EditorToolButtons({
  menuPlacement = "down",
  noMediaTitle = "Add media to enable",
}: EditorToolButtonsProps) {
  const snapEnabled = useEditor((s) => s.snapEnabled);
  const setSnapEnabled = useEditor((s) => s.setSnapEnabled);
  const mode = useEditor((s) => s.mode);
  const setMode = useEditor((s) => s.setMode);
  const splitAtPlayhead = useEditor((s) => s.splitSelectedAtPlayhead);
  const splitAtLoopRange = useEditor((s) => s.splitAtLoopBoundaries);
  const loopEnabled = useEditor((s) => s.loopEnabled);
  const loopIn = useEditor((s) => s.loopIn);
  const loopOut = useEditor((s) => s.loopOut);
  const hasMedia = useEditor((s) => s.clipOrder.length > 0);
  const canSplitAtLoop = hasMedia && loopEnabled && loopOut > loopIn;

  return (
    <div
      className="flex items-center gap-0.5"
      aria-disabled={!hasMedia}
      title={hasMedia ? undefined : noMediaTitle}
    >
      <SelectToolsMenu
        mode={mode}
        setMode={setMode}
        menuPlacement={menuPlacement}
        disabled={!hasMedia}
        noMediaTitle={noMediaTitle}
      />

      <Divider />

      <IconBtn
        title={hasMedia ? "Cut (C)" : noMediaTitle}
        onClick={() => setMode("cut")}
        active={mode === "cut"}
        disabled={!hasMedia}
      >
        <ContentCut width={20} height={20} />
      </IconBtn>

      <Divider />

      <IconBtn
        title={hasMedia ? "Split at playhead" : noMediaTitle}
        onClick={splitAtPlayhead}
        disabled={!hasMedia}
      >
        <SplitAtPlayhead width={20} height={20} />
      </IconBtn>
      <IconBtn
        title={hasMedia ? "Split at loop range" : noMediaTitle}
        onClick={splitAtLoopRange}
        disabled={!canSplitAtLoop}
      >
        <SplitAtLoop width={20} height={20} />
      </IconBtn>

      <Divider />

      <IconBtn
        title={hasMedia ? (snapEnabled ? "Snap on" : "Snap off") : noMediaTitle}
        onClick={() => setSnapEnabled(!snapEnabled)}
        active={snapEnabled}
        disabled={!hasMedia}
      >
        <Magnet active={snapEnabled} width={20} height={20} />
      </IconBtn>
    </div>
  );
}

/* ── Undo / Redo ─────────────────────────────────────────────────────── */

export function EditorUndoRedo() {
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s._past.length > 0);
  const canRedo = useEditor((s) => s._future.length > 0);

  return (
    <div className="flex items-center gap-0.5">
      <IconBtn title="Undo (⌘Z)" onClick={undo} disabled={!canUndo}>
        <Undo width={20} height={20} />
      </IconBtn>
      <IconBtn title="Redo (⌘⇧Z)" onClick={redo} disabled={!canRedo}>
        <Redo width={20} height={20} />
      </IconBtn>
    </div>
  );
}

/* ── Export pill ─────────────────────────────────────────────────────── */

export type EditorExportButtonProps = {
  noMediaTitle?: string;
};

export function EditorExportButton({
  noMediaTitle = "Add media to enable export",
}: EditorExportButtonProps = {}) {
  const setExporting = useEditor((s) => s.setExporting);
  const hasMedia = useEditor((s) => s.clipOrder.length > 0);
  return (
    <button
      type="button"
      onClick={() => setExporting(true)}
      disabled={!hasMedia}
      title={hasMedia ? undefined : noMediaTitle}
      aria-disabled={!hasMedia}
      className="inline-flex items-center rounded-md px-3 sm:px-4 py-1.5 text-[13px] font-semibold transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:hover:brightness-100"
      style={{
        backgroundColor: hasMedia ? "#e4e4e7" : "rgba(228,228,231,0.25)",
        color: hasMedia ? "#0a0a0a" : "rgba(10,10,10,0.55)",
      }}
    >
      Export
    </button>
  );
}

/* ── Primitives ──────────────────────────────────────────────────────── */

function IconBtn({
  title,
  onClick,
  disabled,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className="w-[34px] h-[34px] rounded-md inline-flex items-center justify-center transition-colors disabled:cursor-not-allowed"
      style={{
        color: disabled
          ? "rgba(255,255,255,0.2)"
          : active
          ? "#ffffff"
          : "rgba(255,255,255,0.55)",
        backgroundColor: active ? "rgba(255,255,255,0.10)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (disabled || active) return;
        e.currentTarget.style.color = "#ffffff";
        e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)";
      }}
      onMouseLeave={(e) => {
        if (disabled || active) return;
        e.currentTarget.style.color = "rgba(255,255,255,0.55)";
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      className="self-center w-px h-4 mx-1.5"
      style={{ backgroundColor: "rgba(255, 255, 255, 0.10)" }}
    />
  );
}

/**
 * Combined select/range/hand tool. A single icon button activates the
 * currently-displayed tool; a long-press (≥400 ms) opens the dropdown,
 * and a short click while already in the group toggles it. A corner caret
 * appears on hover, keyboard focus, or while the menu is open — keeping
 * the toolbar visually quiet at rest while still hinting at the dropdown
 * affordance during interaction.
 */
function SelectToolsMenu({
  mode,
  setMode,
  menuPlacement = "down",
  disabled = false,
  noMediaTitle,
}: {
  mode: EditorMode;
  setMode: (m: EditorMode) => void;
  menuPlacement?: "up" | "down";
  disabled?: boolean;
  noMediaTitle: string;
}) {
  const [openRaw, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  /* Force-close while disabled — derived in render, no effect required. */
  const open = openRaw && !disabled;

  const inGroup = mode === "select" || mode === "range" || mode === "hand";

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: globalThis.MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
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

  const ActiveIcon =
    mode === "hand" ? PanTool : mode === "range" ? RangeTool : ArrowSelectorTool;

  const caretVisible = hover || focused || open;

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        title={disabled ? noMediaTitle : "Select tools (V, A, H)"}
        aria-label="Select tools"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onPointerDown={() => {
          if (disabled) return;
          longPressFired.current = false;
          longPressTimer.current = setTimeout(() => {
            longPressFired.current = true;
            setOpen(true);
            longPressTimer.current = null;
          }, 400);
        }}
        onPointerUp={() => {
          if (disabled) return;
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
          if (longPressFired.current) return;
          if (inGroup) {
            setOpen((v) => !v);
          } else {
            setMode("select");
          }
        }}
        onPointerLeave={() => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
          setHover(false);
        }}
        onPointerEnter={() => { if (!disabled) setHover(true); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="relative w-[34px] h-[34px] rounded-md inline-flex items-center justify-center transition-colors disabled:cursor-not-allowed"
        style={{
          color: disabled
            ? "rgba(255,255,255,0.2)"
            : inGroup || hover
            ? "#ffffff"
            : "rgba(255,255,255,0.55)",
          backgroundColor: disabled
            ? "transparent"
            : inGroup
            ? "rgba(255,255,255,0.10)"
            : hover
            ? "rgba(255,255,255,0.05)"
            : "transparent",
        }}
      >
        <ActiveIcon width={20} height={20} />
        <svg
          aria-hidden
          viewBox="0 0 8 8"
          fill="currentColor"
          width="6"
          height="6"
          style={{
            position: "absolute",
            right: 2,
            bottom: 2,
            opacity: caretVisible ? 0.7 : 0,
            transition: "opacity 140ms ease",
            pointerEvents: "none",
          }}
        >
          <path d="M8 8 L0 8 L8 0 Z" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className={
            menuPlacement === "up"
              ? "absolute left-0 bottom-full mb-1.5 z-30 flex flex-col py-1"
              : "absolute left-0 top-full mt-1.5 z-30 flex flex-col py-1"
          }
          style={{
            minWidth: 160,
            background: "rgba(30, 30, 30, 0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: 10,
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6)",
          }}
        >
          <SelectToolsMenuItem
            icon={<ArrowSelectorTool width={16} height={16} />}
            label="Select"
            shortcut="V"
            active={mode === "select"}
            onClick={() => { setMode("select"); setOpen(false); }}
          />
          <SelectToolsMenuItem
            icon={<RangeTool width={16} height={16} />}
            label="Range"
            shortcut="A"
            active={mode === "range"}
            onClick={() => { setMode("range"); setOpen(false); }}
          />
          <SelectToolsMenuItem
            icon={<PanTool width={16} height={16} />}
            label="Hand"
            shortcut="H"
            active={mode === "hand"}
            onClick={() => { setMode("hand"); setOpen(false); }}
          />
        </div>
      )}
    </div>
  );
}

function SelectToolsMenuItem({
  icon,
  label,
  shortcut,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  shortcut: string;
  active?: boolean;
  onClick: (e: MouseEvent) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex items-center justify-between text-left transition-colors"
      style={{
        width: "100%",
        padding: "6px 12px",
        background: hover ? "rgba(255,255,255,0.08)" : "transparent",
        color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.7)",
        border: "none",
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      <div className="flex items-center gap-3">
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)",
          }}
        >
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5 }}>
        {shortcut}
      </span>
    </button>
  );
}
