"use client";

/**
 * useEditorShortcuts — installs the editor's keyboard bindings.
 *
 * Every binding here is mode-agnostic: clip ops (copy/cut/paste/duplicate/
 * delete), transport (Space, arrows, Home/End), tool modes (V/H/A/C),
 * snap & loop toggles, in/out points, zoom, undo/redo. Audio's `ensureRunning`
 * unlock-on-first-gesture concern is exposed as `beforePlay`; video can omit.
 *
 * Bindings are no-ops while no media exists on the timeline (see the early
 * return below), so a fresh project's stray keypresses don't toggle hidden
 * state.
 */
import { useEffect } from "react";
import { useEditor } from "./store";
import { clock } from "./clock";
import { zoomByFactor } from "./laneScroll";

export type EditorShortcutsOptions = {
  /** Optional pre-play hook (audio passes ensureRunning to unlock the
   *  AudioContext on the first user gesture). */
  beforePlay?: () => void | Promise<void>;
};

export function useEditorShortcuts({ beforePlay }: EditorShortcutsOptions = {}) {
  /* Read all action setters once. They're stable refs from Zustand so the
     useEffect deps array can list them without churn. */
  const transportToggle = useEditor((s) => s.transportToggle);
  const seek = useEditor((s) => s.seek);
  const stepFrames = useEditor((s) => s.stepFrames);
  const stepSeconds = useEditor((s) => s.stepSeconds);
  const splitSelected = useEditor((s) => s.splitSelectedAtPlayhead);
  const splitAtLoop = useEditor((s) => s.splitAtLoopBoundaries);
  const copyClip = useEditor((s) => s.copyClip);
  const cutClip = useEditor((s) => s.cutClip);
  const pasteClip = useEditor((s) => s.pasteClip);
  const duplicateClip = useEditor((s) => s.duplicateClip);
  const removeClip = useEditor((s) => s.removeClip);
  const removeTrack = useEditor((s) => s.removeTrack);
  const closeGap = useEditor((s) => s.closeGap);
  const setSelectedGap = useEditor((s) => s.setSelectedGap);
  const duplicateTrack = useEditor((s) => s.duplicateTrack);
  const setZoom = useEditor((s) => s.setZoom);
  const setSnapEnabled = useEditor((s) => s.setSnapEnabled);
  const setLoopEnabled = useEditor((s) => s.setLoopEnabled);
  const setLoopIn = useEditor((s) => s.setLoopIn);
  const setLoopOut = useEditor((s) => s.setLoopOut);
  const setMode = useEditor((s) => s.setMode);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) return;

      /* Until any media exists on the timeline, every editing/transport/tool
         shortcut is a no-op. Drop and record are the only ways to bring the
         editor to life and neither uses the keyboard. */
      if (useEditor.getState().clipOrder.length === 0) return;

      /* Copy / Cut / Paste / Duplicate */
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && !e.shiftKey) {
        e.preventDefault(); copyClip(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "x") {
        e.preventDefault(); cutClip(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault(); pasteClip(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault(); duplicateClip(); return;
      }
      /* Undo / Redo */
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault(); undo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault(); redo(); return;
      }
      /* Snap toggle — S */
      if ((e.key === "s" || e.key === "S") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setSnapEnabled(!useEditor.getState().snapEnabled);
        return;
      }
      /* Loop toggle — L */
      if ((e.key === "l" || e.key === "L") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setLoopEnabled(!useEditor.getState().loopEnabled);
        return;
      }
      /* Loop in / out — I / O (Alt to clear) */
      if (e.altKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault(); setLoopIn(0); return;
      }
      if (e.altKey && (e.key === "o" || e.key === "O")) {
        e.preventDefault(); setLoopOut(0); return;
      }
      if ((e.key === "i" || e.key === "I") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); setLoopIn(clock.time()); return;
      }
      if ((e.key === "o" || e.key === "O") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); setLoopOut(clock.time()); return;
      }
      /* Tool modes — V, H, A, C */
      if ((e.key === "v" || e.key === "V") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); setMode("select"); return;
      }
      if ((e.key === "h" || e.key === "H") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); setMode("hand"); return;
      }
      if ((e.key === "a" || e.key === "A") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); setMode("range"); return;
      }
      if ((e.key === "c" || e.key === "C") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); setMode("cut"); return;
      }
      /* Zoom — +/-/0 (cursor anchored when wheeled, playhead when keyed). */
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault(); zoomByFactor(1.5); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault(); zoomByFactor(1 / 1.5); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        const total = useEditor.getState().totalDuration();
        const panelW = window.innerWidth - 232;
        setZoom(Math.max(8, panelW / Math.max(1, total)));
        return;
      }
      /* Transport — Space */
      if (e.code === "Space") {
        e.preventDefault();
        /* Blur whatever button last had focus so the next Space doesn't
           re-trigger it. */
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        void beforePlay?.();
        transportToggle();
        return;
      }
      /* Delete — Shift escalates to track; gap selection beats clip. */
      if (e.key === "Delete" || e.key === "Backspace") {
        if (e.shiftKey) {
          const tid = useEditor.getState().selectedTrackId;
          if (tid) { e.preventDefault(); removeTrack(tid); }
          return;
        }
        const gap = useEditor.getState().selectedGap;
        if (gap) {
          e.preventDefault();
          closeGap(gap.trackId, gap.start, gap.end);
          return;
        }
        const id = useEditor.getState().selectedClipId;
        if (id) { e.preventDefault(); removeClip(id); }
        return;
      }
      /* Escape — clear gap selection, then clear loop region. */
      if (e.key === "Escape") {
        const st = useEditor.getState();
        if (st.selectedGap) { e.preventDefault(); setSelectedGap(null); return; }
        if (st.loopIn < st.loopOut) {
          e.preventDefault();
          setLoopEnabled(false);
          setLoopIn(0);
          setLoopOut(0);
        }
        return;
      }
      /* Shift+D — duplicate current track. */
      if ((e.key === "d" || e.key === "D") && e.shiftKey) {
        const tid = useEditor.getState().selectedTrackId;
        if (tid) { e.preventDefault(); duplicateTrack(tid); }
        return;
      }
      /* Split — Alt+K splits at loop boundaries; K splits at playhead. */
      if ((e.key === "k" || e.key === "K") && e.altKey) {
        e.preventDefault(); splitAtLoop(); return;
      }
      if (e.key === "k" || e.key === "K") {
        e.preventDefault(); splitSelected(); return;
      }
      /* Step — Shift = 1 second, otherwise 1 frame. */
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (e.shiftKey) stepSeconds(-1); else stepFrames(-1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (e.shiftKey) stepSeconds(1); else stepFrames(1);
        return;
      }
      /* Home / End — start / total. */
      if (e.key === "Home") { e.preventDefault(); seek(0); return; }
      if (e.key === "End") {
        e.preventDefault();
        seek(useEditor.getState().totalDuration());
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    beforePlay, transportToggle, seek, stepFrames, stepSeconds,
    splitSelected, splitAtLoop, copyClip, cutClip, pasteClip, duplicateClip,
    removeClip, removeTrack, closeGap, setSelectedGap, duplicateTrack,
    setZoom, setSnapEnabled, setLoopEnabled, setLoopIn, setLoopOut, setMode,
    undo, redo,
  ]);
}
