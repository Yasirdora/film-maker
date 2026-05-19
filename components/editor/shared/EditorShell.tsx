"use client";

/**
 * EditorShell — the chrome that wraps every timeline-based editor.
 *
 * Responsibilities:
 *   1. Outer flex container (row on desktop, column on mobile).
 *   2. Page-wide file drop: handlers + a capture-phase reset so child
 *      drop zones can `stopPropagation` without leaving the green
 *      drag-over overlay stuck on.
 *   3. SideRail on desktop (mobile hides it; help lives in the kebab).
 *   4. The rounded chrome container — exposed as `<EditorChrome>` so
 *      consumers can pick `direction="row" | "column"` for the inner
 *      layout (video desktop wants row; audio always wants column).
 *   5. Drop-over overlay (green ring) — desktop only; mobile uses native
 *      taps so an OS-level drag is not part of the model.
 *
 * Composition:
 *
 *   <EditorShell onFiles={...} onShowHelp={...}>
 *     ...maybe a pre-chrome region (e.g. <RecordPanel /> in audio)...
 *     <EditorChrome direction={isMobile ? "column" : "row"}>
 *       ...timeline, preview, inspector, dock, mobile bar...
 *     </EditorChrome>
 *   </EditorShell>
 *
 * The shell stays headless about WHAT goes inside the chrome — that's
 * what makes one component serve the video / audio (and future) editors
 * without an explosion of slots.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useIsMobile } from "@/lib/editor/useMediaQuery";
import SideRail from "./SideRail";

export interface EditorShellProps {
  /** Called when files are dropped anywhere on the shell. */
  onFiles: (files: FileList | null) => void;
  /** SideRail forwards this through; called when the user opens help. */
  onShowHelp: () => void;
  /** Editor body — typically a `<main>` wrapping `<EditorChrome>`. */
  children: ReactNode;
}

export default function EditorShell({
  onFiles,
  onShowHelp,
  children,
}: EditorShellProps) {
  const isMobile = useIsMobile();
  const [dragOver, setDragOver] = useState(false);

  /* Child drop zones inside the editor (e.g. lanes) commonly call
     `stopPropagation()` to handle the drop locally. Without a global
     reset the page-wide overlay would stay highlighted forever. A
     capture-phase listener on `document` always fires before any
     bubbling stops, so the overlay clears regardless. */
  useEffect(() => {
    const reset = () => setDragOver(false);
    document.addEventListener("drop", reset, true);
    return () => document.removeEventListener("drop", reset, true);
  }, []);

  /* Mobile devices don't surface file-drag-and-drop the same way and the
     overlay would interfere with native tap targets — disable the drop
     wiring entirely there. The file picker in `<MobileEditingBar>` is
     the mobile import path. */
  const desktopDropHandlers = isMobile
    ? null
    : {
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault();
          setDragOver(true);
        },
        onDragLeave: (e: React.DragEvent) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragOver(false);
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        },
      };

  return (
    <div
      className="font-ae"
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        background: "var(--color-ae-bg)",
        color: "var(--color-ae-fg, #ffffff)",
        overflow: "hidden",
        userSelect: "none",
      }}
      {...desktopDropHandlers}
    >
      {!isMobile && <SideRail onShowHelp={onShowHelp} />}
      {children}
      {!isMobile && dragOver && <DropOverlay />}
    </div>
  );
}

/**
 * The rounded chrome container that holds preview / timeline / dock.
 * Margin and border vanish on mobile so the editor reads edge-to-edge.
 */
export function EditorChrome({
  direction = "column",
  children,
}: {
  /** Inner flex direction. Video desktop wants "row" (timeline column +
   *  inspector column); audio always wants "column". */
  direction?: "row" | "column";
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  return (
    <div
      className="flex-grow relative overflow-hidden"
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : direction,
        minHeight: 0,
        margin: isMobile ? 0 : "0 12px 12px 0",
        borderRadius: isMobile ? 0 : 16,
        border: isMobile ? "none" : "1px solid rgba(255,255,255,0.12)",
        background: isMobile ? "transparent" : "var(--color-ae-lane)",
        boxShadow: isMobile ? "none" : "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      {children}
    </div>
  );
}

function DropOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0"
      style={{
        boxShadow: "inset 0 0 0 3px rgba(50,215,75,0.55)",
        background: "rgba(50,215,75,0.04)",
        zIndex: 10000,
      }}
    />
  );
}
