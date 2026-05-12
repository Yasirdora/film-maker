"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "@/lib/editor/store";
import { clock } from "@/lib/editor/clock";
import { registerLaneScroller, zoomByFactor } from "@/lib/editor/laneScroll";
import { useIsMobile } from "@/lib/editor/useMediaQuery";
import type { Clip, EditorMode, Track } from "@/lib/editor/types";
import { fmtDuration } from "@/lib/editor/media";
import { collectSnapTargets, snapTime } from "@/lib/editor/snap";
import { importFiles } from "@/lib/editor/importFiles";
import { useLatest } from "@/lib/editor/useLatest";
import ClipContextMenu from "./ClipContextMenu";
import LoopContextMenu from "./LoopContextMenu";
import TrackKebabMenu from "./TrackKebabMenu";
import {
  ChevronRight,
  LockClosed,
  LockOpen,
  VolumeUp,
} from "./icons";
import {
  TimelineConfigProvider,
  useTimelineConfig,
  type TimelineConfig,
} from "./timelineConfig";

export type TimelineProps = {
  config: TimelineConfig;
  mode: EditorMode;
  isHeaderCollapsed?: boolean;
  setIsHeaderCollapsed?: (v: boolean) => void;
  showHelp?: boolean;
  setShowHelp?: (v: boolean) => void;
};

/**
 * Mode-agnostic timeline shell. Picks the desktop or mobile layout based on
 * viewport, propagates the supplied <TimelineConfig> via context so deep
 * children (track headers, lane drop zones, etc.) can read the per-kind
 * filters, copy, and renderers without prop drilling.
 */
export default function Timeline({
  config,
  mode,
  isHeaderCollapsed = false,
  setIsHeaderCollapsed,
  showHelp = false,
  setShowHelp,
}: TimelineProps) {
  const isMobile = useIsMobile();

  return (
    <TimelineConfigProvider config={config}>
      {isMobile ? (
        <MobileTimeline mode={mode} />
      ) : (
        <DesktopTimeline
          mode={mode}
          isHeaderCollapsed={isHeaderCollapsed}
          setIsHeaderCollapsed={setIsHeaderCollapsed}
          setShowHelp={setShowHelp!}
        />
      )}
      {showHelp && <ShortcutsModal onClose={() => setShowHelp?.(false)} />}
    </TimelineConfigProvider>
  );
}

/* ════════════════════════════════════════════════════════════════════ */
/* DESKTOP                                                              */
/* Sticky-left header column inside a single horizontally-scrolling     */
/* container. Header has name + S/M/Lock, then slider + dB readout,     */
/* then a horizontal gradient level meter. Clips render with            */
/* translucent track-color bodies.                                      */
/* ════════════════════════════════════════════════════════════════════ */

const DESK_TRACK_HEIGHT = 94;
const DESK_HEADER_W = 232;
const DESK_RULER_H = 32;
const DESK_SPACER_H = 0;
/* Pinned Add-Track footer at the bottom of the left column. The right
   (lane) panel reserves the same height as an invisible spacer so the
   two scroll containers have identical viewport heights — required for
   1:1 vertical scroll sync. Update both sides if this changes. */
const DESK_FOOTER_H = 54;

function DesktopTimeline({
  mode,
  isHeaderCollapsed = false,
  setIsHeaderCollapsed,
}: {
  mode: EditorMode;
  isHeaderCollapsed?: boolean;
  setIsHeaderCollapsed?: (v: boolean) => void;
  setShowHelp: (v: boolean) => void;
}) {
  const config = useTimelineConfig();
  /* JSX requires PascalCase identifiers; hoist out of `config` so the lane
     loops can write `<ClipBlock>` directly. */
  const { ClipBlock } = config;
  const tracks = useEditor((s) => s.tracks);
  const clips = useEditor((s) => s.clips);
  const clipOrder = useEditor((s) => s.clipOrder);
  const total = useEditor((s) => s.totalDuration());
  const seek = useEditor((s) => s.seek);
  const zoom = useEditor((s) => s.zoom);
  const selectedClipId = useEditor((s) => s.selectedClipId);
  const setSelectedClip = useEditor((s) => s.setSelectedClip);
  const moveClip = useEditor((s) => s.moveClip);
  const trimClipStart = useEditor((s) => s.trimClipStart);
  const trimClipEnd = useEditor((s) => s.trimClipEnd);
  const commitClipEdit = useEditor((s) => s.commitClipEdit);
  const updateTrack = useEditor((s) => s.updateTrack);
  const snapIndicator = useEditor((s) => s.snapIndicator);
  const loopEnabled = useEditor((s) => s.loopEnabled);
  const loopIn = useEditor((s) => s.loopIn);
  const loopOut = useEditor((s) => s.loopOut);
  const setLoopIn = useEditor((s) => s.setLoopIn);
  const setLoopOut = useEditor((s) => s.setLoopOut);
  const setLoopEnabled = useEditor((s) => s.setLoopEnabled);
  const snapEnabled = useEditor((s) => s.snapEnabled);

  /* Context menu for right-clicked clips. */
  const [ctxMenu, setCtxMenu] = useState<{ clipId: string; x: number; y: number } | null>(null);
  const [loopCtxMenu, setLoopCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [razorGuideX, setRazorGuideX] = useState<number | null>(null);
  const HEADER_W = isHeaderCollapsed ? 60 : DESK_HEADER_W;

  // Lay clips back-to-back starting at the playhead so multi-file drops
  // don't all stack at the same start position on the same track.
  const importToTrack = useCallback(
    (trackId: string, files: FileList | null) =>
      importFiles(files, config, {
        trackId,
        startAt: clock.time(),
        onFirstClipPlaced: seek,
      }),
    [config, seek],
  );

  const visibleTracks = useMemo(
    () => tracks.filter((t) => t.kind === config.kind),
    [tracks, config.kind],
  );

  /* `scrollRef` is the LANE scroller — horizontal scroll only. Vertical
     scroll lives on `bodyScrollRef`, the shared scroll container that
     wraps both the headers column and the lane scroller, so headers and
     lanes scroll together naturally without any JS sync. `rulerScrollRef`
     is the ruler's horizontal scroller; we mirror its scrollLeft from
     scrollRef so the ruler ticks track the lanes' horizontal scroll. */
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const rulerScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const lane = scrollRef.current;
    const ruler = rulerScrollRef.current;
    if (!lane || !ruler) return;
    const onLaneScroll = () => {
      if (ruler.scrollLeft !== lane.scrollLeft) ruler.scrollLeft = lane.scrollLeft;
    };
    onLaneScroll();
    lane.addEventListener("scroll", onLaneScroll, { passive: true });
    return () => lane.removeEventListener("scroll", onLaneScroll);
  }, []);
  /* One ref slot per visible lane (aligned by index to visibleTracks). */
  const laneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [panelWidth, setPanelWidth] = useState(0);
  const scrubbing = useRef(false);
  const setZoom = useEditor((s) => s.setZoom);
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  const setLanePanelWidth = useEditor((s) => s.setLanePanelWidth);

  /* Auto-fit when newly imported media extends beyond the current viewport.
     Tracks the previous total so only an *increase* in duration triggers it. */
  const prevTotal = useRef(total);
  useEffect(() => {
    const prev = prevTotal.current;
    prevTotal.current = total;

    /* Only react to increases in total duration. */
    if (total <= prev) return;

    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;

    /* Check whether the new content falls outside the visible area. */
    const visibleEnd = (el.scrollLeft + el.clientWidth) / zoom;
    if (total <= visibleEnd) return; // already in view — don't disturb zoom

    /* Fit: choose a zoom so the whole timeline fills the panel, then
       scroll to the start so the user sees everything from the beginning. */
    const fitZ = Math.max(1, Math.min(200, el.clientWidth / total));
    setZoom(fitZ);
    /* Use rAF so the new zoom propagates before we reset scroll. */
    requestAnimationFrame(() => {
      if (el) el.scrollLeft = 0;
    });
  }, [total, zoom, setZoom]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    /* Publish the lane scroller so global zoom helpers (keyboard
       shortcuts in AudioEditor, the zoom buttons here, the wheel
       handler) can anchor on the playhead consistently. */
    registerLaneScroller(el);
    const update = () => {
      setPanelWidth(el.clientWidth);
      setLanePanelWidth(el.clientWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      registerLaneScroller(null);
    };
  }, [setLanePanelWidth]);

  /* Pinch-to-zoom: must use a native listener with passive:false so
     preventDefault() actually blocks the browser's page zoom. Anchored
     on the cursor — wheel/pinch already give the user a precise focal
     point, so the natural mental model is "magnify under my finger".
     Other zoom paths (buttons, keyboard) have no cursor and pivot on
     the playhead instead. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const z = zoomRef.current;
      const rect = el.getBoundingClientRect();
      const cursorT = (e.clientX - rect.left + el.scrollLeft) / z;
      const nextZoom = Math.max(1, Math.min(400, z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      setZoom(nextZoom);
      requestAnimationFrame(() => {
        el.scrollLeft = cursorT * nextZoom - (e.clientX - rect.left);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setZoom]);

  const xToTime = useCallback(
    (clientX: number): number => {
      const el = scrollRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return Math.max(0, (clientX - rect.left + el.scrollLeft) / zoom);
    },
    [zoom],
  );

  /* Returns the id of the audio-track lane whose bounding rect contains
     the given clientY, or undefined when the cursor is outside all lanes. */
  /**
   * State machine for the "drag past the last lane to spawn a new track"
   * gesture, mirroring Premiere / CapCut behaviour.
   *
   *  - `dragCreatedTrackRef` holds the id of the track we lazily added
   *    during the active drag. Cleared on drag-end; if the clip never
   *    settled on it, `handleClipDragEnd` removes the orphan lane.
   *  - `setNewlyCreatedTrack` flags the same id for the entry animation
   *    so the lane fades + slides in instead of popping.
   *  - `dropHintActive` drives the dashed phantom-lane preview that
   *    appears while the cursor sits in the create-zone but has not yet
   *    crossed the commit threshold — gives the user a "release here"
   *    cue before the lane materialises.
   */
  const dragCreatedTrackRef = useRef<string | null>(null);
  const [newlyCreatedTrackId, setNewlyCreatedTrackId] = useState<string | null>(
    null,
  );
  const [dropHintActive, setDropHintActive] = useState(false);

  /** px below the last lane before we commit to creating a new track. */
  const NEW_TRACK_COMMIT_PX = 24;

  const resolveTrackAtY = useCallback(
    (clientY: number): string | undefined => {
      const tracks = useEditor
        .getState()
        .tracks.filter((t) => t.kind === config.kind);
      for (let i = 0; i < tracks.length; i++) {
        const el = laneRefs.current[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientY >= rect.top && clientY < rect.bottom) {
          setDropHintActive(false);
          return tracks[i].id;
        }
      }
      if (tracks.length === 0) {
        setDropHintActive(false);
        return undefined;
      }
      const lastEl = laneRefs.current[tracks.length - 1];
      if (!lastEl) return dragCreatedTrackRef.current ?? undefined;
      const lastBottom = lastEl.getBoundingClientRect().bottom;
      if (clientY < lastBottom) {
        setDropHintActive(false);
        return undefined;
      }
      // Below the last lane — show the dashed phantom hint as soon as
      // the cursor enters this zone; commit (create the track) only once
      // the cursor has descended past the buffer so a 1px overshoot
      // doesn't spawn an orphan lane.
      setDropHintActive(true);
      if (dragCreatedTrackRef.current) return dragCreatedTrackRef.current;
      if (clientY < lastBottom + NEW_TRACK_COMMIT_PX) return undefined;
      const newId = useEditor.getState().addTrack(config.kind);
      dragCreatedTrackRef.current = newId;
      setNewlyCreatedTrackId(newId);
      // Drop the entry-animation marker after the keyframe has run so
      // the lane keeps the natural style on subsequent renders.
      window.setTimeout(() => {
        setNewlyCreatedTrackId((curr) => (curr === newId ? null : curr));
      }, 260);
      return newId;
    },
    [config.kind],
  );

  const handleClipDragEnd = useCallback(() => {
    const created = dragCreatedTrackRef.current;
    dragCreatedTrackRef.current = null;
    setDropHintActive(false);
    if (!created) return;
    const state = useEditor.getState();
    const hasClips = Object.values(state.clips).some(
      (c) => c.trackId === created,
    );
    if (!hasClips) state.removeTrack(created);
  }, []);

  const setSnapIndicator = useEditor((s) => s.setSnapIndicator);

  const snapSeek = useCallback(
    (raw: number) => {
      if (!snapEnabled) { seek(raw); return; }
      const { clips: c, clipOrder: o } = useEditor.getState();
      const targets = collectSnapTargets(c, o, "__playhead__", raw);
      const { snapped, indicator } = snapTime(raw, targets, zoom);
      setSnapIndicator(indicator);
      seek(snapped);
    },
    [snapEnabled, zoom, seek, setSnapIndicator],
  );

  const beginScrub = (
    e: React.MouseEvent,
    opts: { allowLoop?: boolean; autoEnableLoop?: boolean } = {},
  ) => {
    const { allowLoop = true, autoEnableLoop = true } = opts;
    e.preventDefault();
    const startX = e.clientX;
    const startTime = xToTime(startX);
    scrubbing.current = true;
    snapSeek(startTime);

    let creatingLoop = false;

    const onMove = (ev: MouseEvent) => {
      if (!scrubbing.current) return;
      if (allowLoop && !creatingLoop && Math.abs(ev.clientX - startX) > 4) {
        creatingLoop = true;
        setSnapIndicator(null);
      }
      if (creatingLoop) {
        const t = xToTime(ev.clientX);
        setLoopIn(Math.min(startTime, t));
        setLoopOut(Math.max(startTime, t));
      } else {
        snapSeek(xToTime(ev.clientX));
      }
    };
    const onUp = () => {
      scrubbing.current = false;
      setSnapIndicator(null);
      if (creatingLoop && autoEnableLoop) setLoopEnabled(true);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    // Middle click pan OR mode === "hand" pan
    if (e.button === 1 || (e.button === 0 && mode === "hand")) {
      e.preventDefault();
      const lane = scrollRef.current;
      const body = bodyScrollRef.current;
      if (!lane) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const startScrollLeft = lane.scrollLeft;
      const startScrollTop = body?.scrollTop ?? 0;

      const onMove = (ev: MouseEvent) => {
        lane.scrollLeft = startScrollLeft - (ev.clientX - startX);
        if (body) body.scrollTop = startScrollTop - (ev.clientY - startY);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      return;
    }

    if (e.button === 0 && mode === "range") {
      beginScrub(e, { autoEnableLoop: false });
      return;
    }
  };

  /* Auto-scroll: direct clock subscription — no React re-render needed. */
  useEffect(() => {
    const unsub = clock.subscribe(() => {
      const el = scrollRef.current;
      if (!el || !clock.playing()) return;
      const playheadX = clock.time() * zoomRef.current;
      const visStart = el.scrollLeft;
      const visEnd = el.scrollLeft + el.clientWidth;
      if (playheadX > visEnd - el.clientWidth * 0.2) {
        el.scrollLeft = Math.max(0, playheadX - el.clientWidth * 0.5);
      } else if (playheadX < visStart) {
        el.scrollLeft = Math.max(0, playheadX - el.clientWidth * 0.1);
      }
    });
    return unsub;
  }, []);

  const contentWidth = Math.max(panelWidth || 800, total * zoom + 200);

  /* Explicit pixel height for the lane scroller's inner content. The
     dual `height: lanesContentHeight` + `minHeight: 100%` on the inner
     div below is intentional:

       • The explicit pixel height keeps the inner div tall enough to
         hold every lane row when the stack exceeds the viewport, so
         bodyScrollRef's vertical scroll governs visibility instead of
         the lane scroller's `overflowY: hidden` (which would otherwise
         clip rows past the viewport — visible as missing lanes once
         you cross ~8 tracks).

       • The `minHeight: 100%` resolves against the lane scroller's
         flex-stretched height (the body viewport) and only kicks in
         when the track stack is shorter than the viewport — so any
         absolutely-positioned overlay (loop band, snap indicator,
         razor guide) reaches the body's bottom edge instead of
         stopping at the last track + spacer.

     The trailing DESK_FOOTER_H + 120 spacers mirror the headers column
     so both scroll-content heights stay equal when the stack overflows. */
  const lanesContentHeight = useMemo(
    () =>
      visibleTracks.reduce(
        (sum, tr) =>
          sum + (tr.collapsed ? DESK_TRACK_HEIGHT_COLLAPSED : DESK_TRACK_HEIGHT),
        0,
      ) + DESK_FOOTER_H + 120,
    [visibleTracks],
  );

  /* Pre-compute clips per track — avoids re-allocating arrays in the render loop. */
  const clipsByTrack = useMemo(() => {
    const map = new Map<string, Clip[]>();
    for (const id of clipOrder) {
      const c = clips[id];
      if (!c) continue;
      let arr = map.get(c.trackId);
      if (!arr) { arr = []; map.set(c.trackId, arr); }
      arr.push(c);
    }
    return map;
  }, [clips, clipOrder]);

  return (
    <div
      className="flex-1 min-w-0 flex flex-col relative"
      style={{ background: "var(--color-ae-bg)", overflow: "hidden" }}
    >
      {/* Floating Zoom & Snap Controls — Overlayed on Ruler */}
      <div
        className="absolute top-0 right-0 z-[100] flex items-center px-1.5"
        style={{
          height: DESK_RULER_H,
          background: "linear-gradient(to left, rgba(10,10,10,0.95) 80%, transparent)",
          paddingRight: 10,
          gap: 6,
        }}
      >


        <div className="flex items-center gap-1">
          <TimelineToolBtn
            title="Zoom out"
            onClick={() => zoomByFactor(1 / 1.5)}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 8h12" />
            </svg>
          </TimelineToolBtn>
          <TimelineToolBtn
            title="Zoom in"
            onClick={() => zoomByFactor(1.5)}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 8h12M8 2v12" />
            </svg>
          </TimelineToolBtn>
          <TimelineToolBtn
            title="Fit to screen"
            onClick={() => setZoom(Math.max(2, panelWidth / Math.max(1, total)))}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M2 2h4M10 2h4M2 2v4M14 2v4M2 14h4M10 14h4M2 14v-4M14 14v-4" />
            </svg>
          </TimelineToolBtn>
        </div>
      </div>
      {/* ── TOP BAR — header decoration + ruler. Lives above the body
           scroll so it never moves when the user scrolls vertically. ── */}
      <div style={{
        display: "flex",
        flexShrink: 0,
        height: DESK_SPACER_H + DESK_RULER_H,
        position: "relative",
      }}>
        {/* Header decoration — collapse + volume-envelope toggles */}
        <div style={{
          width: HEADER_W,
          minWidth: HEADER_W,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: isHeaderCollapsed ? "center" : "space-between",
          padding: isHeaderCollapsed ? 0 : "0 8px",
          borderRight: "1px solid var(--color-ae-border)",
          borderBottom: "1px solid var(--color-ae-border)",
          background: "#101212",
          transition: "width 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}>
          {!isHeaderCollapsed && config.renderHeaderExtras?.()}
          <button
            type="button"
            onClick={() => setIsHeaderCollapsed?.(!isHeaderCollapsed)}
            className="flex items-center justify-center transition-colors"
            style={{
              width: 26,
              height: 26,
              background: isHeaderCollapsed ? "transparent" : "rgba(255,255,255,0.06)",
              border: "none",
              cursor: "pointer",
              color: isHeaderCollapsed ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.85)",
              borderRadius: 6,
            }}
            title={isHeaderCollapsed ? "Expand panel" : "Collapse panel"}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.color = "rgba(255,255,255,1)";
              if (isHeaderCollapsed) el.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.color = isHeaderCollapsed ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.85)";
              if (isHeaderCollapsed) el.style.background = "transparent";
            }}
          >
            <div style={{ transform: isHeaderCollapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.25s" }}>
              <ChevronRight width={14} height={14} />
            </div>
          </button>
        </div>
        {/* Ruler scroller — overflow-x:hidden so users can't scroll it
            directly; we mirror its scrollLeft from the lane scroller via
            an effect, so the ruler ticks always track the lanes. */}
        <div
          ref={rulerScrollRef}
          style={{
            flex: 1,
            minWidth: 0,
            overflowX: "hidden",
            overflowY: "hidden",
            position: "relative",
          }}
        >
          <div style={{ width: contentWidth, height: "100%", position: "relative" }}>
            <div
              style={{
                height: DESK_SPACER_H,
                background: "#101212",
                borderBottom: "1px solid var(--color-ae-border)",
              }}
            />
            <div
              style={{
                height: DESK_RULER_H,
                background: "rgba(16,18,18,0.95)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                borderBottom: "1px solid var(--color-ae-border)",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const inLoopZone = e.clientY - rect.top >= rect.height / 2;
                e.currentTarget.style.cursor = inLoopZone ? "col-resize" : "ew-resize";
              }}
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const inLoopZone = e.clientY - rect.top >= rect.height / 2;
                beginScrub(e, { allowLoop: inLoopZone });
              }}
            >
              {loopIn < loopOut && (
                <LoopBandFill
                  loopIn={loopIn}
                  loopOut={loopOut}
                  loopEnabled={loopEnabled}
                  zoom={zoom}
                  onSetLoopIn={setLoopIn}
                  onSetLoopOut={setLoopOut}
                  onSetLoopEnabled={setLoopEnabled}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setLoopCtxMenu({ x: e.clientX, y: e.clientY });
                  }}
                />
              )}
              <DesktopRulerTicks
                total={Math.max(total, contentWidth / zoom)}
                zoom={zoom}
                scrollContainerRef={scrollRef}
              />
              {loopIn < loopOut && (
                <LoopHandles
                  loopIn={loopIn}
                  loopOut={loopOut}
                  loopEnabled={loopEnabled}
                  zoom={zoom}
                  onSetLoopIn={setLoopIn}
                  onSetLoopOut={setLoopOut}
                  onSetLoopEnabled={setLoopEnabled}
                />
              )}
              {/* Standalone in/out flags — visible when no valid loop band
                  exists yet, so pressing I or O alone gives immediate feedback. */}
              {loopIn >= loopOut && loopIn > 0 && (
                <LoopFlag t={loopIn} kind="in" zoom={zoom} enabled={loopEnabled} />
              )}
              {loopIn >= loopOut && loopOut > 0 && (
                <LoopFlag t={loopOut} kind="out" zoom={zoom} enabled={loopEnabled} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY — single shared vertical scroll. Headers column and lane
           scroller live inside it so they scroll together naturally with
           no JS sync. The lane scroller has horizontal-only scroll. The
           hard-stop gradient paints the side-panel colour for the first
           HEADER_W pixels and stays transparent past it, so the side
           panel reads as a continuous column even when its content is
           shorter than the visible body. ── */}
      <div
        ref={bodyScrollRef}
        className="ae-no-scrollbar"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          alignItems: "stretch",
          position: "relative",
          background: `linear-gradient(to right, #101212 0, #101212 ${HEADER_W}px, transparent ${HEADER_W}px)`,
        }}
      >
        {/* Headers column — fixed width, no own scroll */}
        <div style={{
          width: HEADER_W,
          minWidth: HEADER_W,
          flexShrink: 0,
          background: "#101212",
          borderRight: "1px solid var(--color-ae-border)",
          zIndex: 25,
          position: "sticky",
          left: 0,
          transition: "width 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}>
          {visibleTracks.map((tr, i) => (
            <DesktopTrackHeader
              key={tr.id}
              track={tr}
              index={i}
              canMoveUp={i > 0}
              canMoveDown={i < visibleTracks.length - 1}
              onUpdate={(p) => updateTrack(tr.id, p)}
              isCollapsed={isHeaderCollapsed}
            />
          ))}
          {/* Add Track — sits right after the last track header, scrolling
              with them so it always reads as "append another one here". */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: DESK_FOOTER_H,
            padding: "0 10px",
            borderBottom: "1px solid var(--color-ae-border)",
          }}>
            <button
              type="button"
              onClick={() => useEditor.getState().addTrack(config.kind)}
              className="flex items-center justify-center transition-colors"
              style={{
                height: 30,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6,
                cursor: "pointer",
                color: "rgba(255,255,255,0.4)",
                fontSize: 12,
                fontWeight: 500,
                gap: 5,
                padding: isHeaderCollapsed ? "0 8px" : "0 16px",
                letterSpacing: 0.1,
              }}
              title="Add track"
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.color = "rgba(255,255,255,0.7)";
                el.style.background = "rgba(255,255,255,0.08)";
                el.style.borderColor = "rgba(255,255,255,0.1)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.color = "rgba(255,255,255,0.4)";
                el.style.background = "rgba(255,255,255,0.04)";
                el.style.borderColor = "rgba(255,255,255,0.06)";
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M7.5 2v5.5H2v1h5.5V14h1V8.5H14v-1H8.5V2z" />
              </svg>
              {!isHeaderCollapsed && <span>Add Track</span>}
            </button>
          </div>
          {/* Bottom breathing room — matches the lane scroller's bottom
              spacer so vertical scroll-content heights stay equal. */}
          <div aria-hidden="true" style={{ height: 120 }} />
        </div>

        {/* Lane scroller — horizontal scroll only */}
        <div
          ref={scrollRef}
          className="scrollbar-dark"
          style={{
            flex: 1,
            minWidth: 0,
            /* Floor the scroller's height at the lane content height so
               its `overflowY: hidden` (needed because the orthogonal axis
               has `overflowX: auto`) never clips real lanes. Without this,
               flex stretch would size the scroller to the bodyScrollRef
               viewport — anything past that would be clipped, which is
               what made tracks past ~8 disappear from the right column. */
            minHeight: lanesContentHeight,
            overflowX: "auto",
            overflowY: "hidden",
            position: "relative",
            cursor: mode === "range" ? "crosshair" : mode === "hand" ? "grab" : "default",
          }}
          onMouseDown={handleTimelineMouseDown}
          onMouseMove={(e) => {
            if (mode !== "cut") { setRazorGuideX(null); return; }
            const el = scrollRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            setRazorGuideX(e.clientX - rect.left + el.scrollLeft);
          }}
          onMouseLeave={() => setRazorGuideX(null)}
        >
          <div style={{ width: contentWidth, height: lanesContentHeight, minHeight: "100%", position: "relative" }}>
            {/* Track lanes */}
            {visibleTracks.map((tr, trIdx) => {
              const rowHeight = tr.collapsed
                ? DESK_TRACK_HEIGHT_COLLAPSED
                : DESK_TRACK_HEIGHT;
              const trackClips = clipsByTrack.get(tr.id) ?? [];
              const isNewlyCreated = newlyCreatedTrackId === tr.id;
              return (
                <div
                  key={tr.id}
                  ref={(el) => { laneRefs.current[trIdx] = el; }}
                  className={isNewlyCreated ? "ae-track-lane-in" : undefined}
                  style={{
                    height: rowHeight,
                    borderBottom: "1px solid var(--color-ae-border)",
                    opacity: tr.locked ? 0.7 : 1,
                    position: "relative",
                    background: tr.muted
                      ? "repeating-linear-gradient(45deg,rgba(8,8,8,1),rgba(8,8,8,1) 6px,rgba(20,20,20,1) 6px,rgba(20,20,20,1) 12px)"
                      : "transparent",
                    backgroundImage: tr.muted
                      ? undefined
                      : "repeating-linear-gradient(90deg,transparent,transparent 99px,rgba(255,255,255,0.025) 100px)",
                  }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void importToTrack(tr.id, e.dataTransfer.files);
                  }}
                >
                  {trackClips.length === 0 && !tr.collapsed && (
                    <TrackEmptyLane trackId={tr.id} panelWidth={panelWidth} />
                  )}
                  {!tr.collapsed && !tr.locked &&
                    computeGaps(trackClips).map((g) => (
                      <GapBlock
                        key={`${tr.id}-${g.start.toFixed(4)}-${g.end.toFixed(4)}`}
                        gap={g}
                        trackId={tr.id}
                        zoom={zoom}
                        variant="desktop"
                      />
                    ))}
                  {trackClips.map((c) => (
                    <ClipBlock
                      key={c.id}
                      mode={mode}
                      clip={c}
                      zoom={zoom}
                      locked={tr.locked}
                      selected={selectedClipId === c.id}
                      variant="desktop"
                      onSelect={() => setSelectedClip(c.id)}
                      onMove={(t, tid) => moveClip(c.id, t, tid)}
                      onTrimStart={(t) => trimClipStart(c.id, t)}
                      onTrimEnd={(t) => trimClipEnd(c.id, t)}
                      resolveTrackAtY={resolveTrackAtY}
                      onDragEnd={() => { commitClipEdit(c.id); handleClipDragEnd(); }}
                      onContextMenu={(cx, cy) => setCtxMenu({ clipId: c.id, x: cx, y: cy })}
                    />
                  ))}
                </div>
              );
            })}

            {dropHintActive && (
              <div
                className="ae-drop-hint"
                style={{
                  height: DESK_TRACK_HEIGHT - 8,
                  margin: "4px 8px",
                }}
              />
            )}

            {/* Loop region — yellow band across all lanes */}
            {loopIn < loopOut && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: loopIn * zoom,
                  width: (loopOut - loopIn) * zoom,
                  top: 0,
                  bottom: 0,
                  background: loopEnabled ? "rgba(255, 214, 10, 0.08)" : "rgba(255, 214, 10, 0.03)",
                  borderLeft: `1px solid rgba(255, 214, 10, ${loopEnabled ? 0.6 : 0.2})`,
                  borderRight: `1px solid rgba(255, 214, 10, ${loopEnabled ? 0.6 : 0.2})`,
                  zIndex: 5,
                }}
              />
            )}

            {/* Snap indicator */}
            {snapIndicator !== null && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: snapIndicator * zoom,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: "#ffd60a",
                  boxShadow: "0 0 6px rgba(255,214,10,0.6)",
                  zIndex: 14,
                }}
              />
            )}

            {/* Razor guide — dashed vertical line following the cursor in cut mode */}
            {razorGuideX !== null && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: razorGuideX,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 4px, transparent 4px, transparent 8px)",
                  zIndex: 15,
                }}
              />
            )}

            {visibleTracks.length === 0 && <EmptyState />}

            {/* Transparent spacer mirroring the headers column's Add Track
                row, so both columns have identical scroll-content heights
                and stay aligned end-to-end. */}
            <div aria-hidden="true" style={{ height: DESK_FOOTER_H }} />
            {/* Bottom breathing room past the lanes — matches the headers
                column's spacer so vertical scroll content stays aligned. */}
            <div aria-hidden="true" style={{ height: 120 }} />
          </div>
        </div>
      </div>

      {/* ── PLAYHEAD — anchored to the viewport. Top: 0 so the caret sits
           OVER the ruler. Horizontal X = time*zoom - lane-scrollLeft,
           tracked by the playhead component. ── */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 0,
          bottom: 0,
          left: HEADER_W,
          right: 0,
          overflow: "hidden",
        }}
      >
        <TimelinePlayhead zoom={zoom} seek={seek} xToTime={xToTime} scrollRef={scrollRef} />
      </div>

      {/* Clip right-click context menu */}
      {ctxMenu && (
        <ClipContextMenu
          clipId={ctxMenu.clipId}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Loop right-click context menu */}
      {loopCtxMenu && (
        <LoopContextMenu
          x={loopCtxMenu.x}
          y={loopCtxMenu.y}
          onClose={() => setLoopCtxMenu(null)}
        />
      )}
    </div>
  );
}

/**
 * Canvas-based ruler — scroll-aware, only renders the visible viewport.
 *
 * Instead of allocating a canvas as wide as the full content (which exceeds
 * browser limits at high zoom), the canvas is only as wide as the viewport
 * plus a small buffer. It repositions itself via `translateX(scrollLeft)` and
 * redraws imperatively on scroll — zero React re-renders.
 */
const DesktopRulerTicks = memo(function DesktopRulerTicks({
  total,
  zoom,
  scrollContainerRef,
}: {
  total: number;
  zoom: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const totalRef = useLatest(total);
  const zoomRef = useLatest(zoom);

  const draw = useCallback(() => {
    const cvs = canvasRef.current;
    const container = scrollContainerRef.current;
    if (!cvs || !container) return;

    const scrollLeft = container.scrollLeft;
    const viewWidth = container.clientWidth;
    if (viewWidth <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasW = viewWidth + 120; // small buffer for label overhang
    const h = DESK_RULER_H;
    const z = zoomRef.current;
    const tot = totalRef.current;

    // Resize canvas only when viewport changes (avoids expensive re-alloc on scroll)
    const targetW = Math.round(canvasW * dpr);
    const targetH = Math.round(h * dpr);
    if (cvs.width !== targetW || cvs.height !== targetH) {
      cvs.width = targetW;
      cvs.height = targetH;
      cvs.style.width = `${canvasW}px`;
      cvs.style.height = `${h}px`;
    }

    // Position canvas at scroll offset
    cvs.style.transform = `translateX(${scrollLeft}px)`;

    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasW, h);

    // Tick density
    const targetPxPerLabel = 80;
    let interval = targetPxPerLabel / z;
    for (const s of [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600]) {
      if (s >= interval) { interval = s; break; }
    }
    const minor = interval / (interval >= 1 ? 5 : 4);

    // Only draw ticks in the visible range
    const startT = Math.max(0, Math.floor((scrollLeft / z) / minor) * minor);
    const endT = Math.min(tot + interval, (scrollLeft + canvasW) / z + minor);

    ctx.font = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    ctx.textBaseline = "top";
    for (let t = startT; t <= endT; t += minor) {
      const x = t * z - scrollLeft; // relative to canvas
      if (x < -60 || x > canvasW + 10) continue;
      const isMajor = Math.abs((t / interval) - Math.round(t / interval)) < 1e-6;
      if (isMajor) {
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(x, h - 14, 1, 14);
        ctx.fillStyle = "rgba(255,255,255,0.50)";
        ctx.fillText(fmtDuration(t), x + 4, 2);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(x, h - 6, 1, 6);
      }
    }
    /* totalRef/zoomRef are stable; listed for the linter so it can verify
       the closure reads them. */
  }, [scrollContainerRef, totalRef, zoomRef]);

  // Redraw on prop changes
  useEffect(() => { draw(); }, [total, zoom, draw]);

  // Redraw on scroll + resize (imperative — no React re-renders)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener("scroll", draw);
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", draw);
      ro.disconnect();
    };
  }, [scrollContainerRef, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none"
      style={{ position: "absolute", top: 0, left: 0, willChange: "transform" }}
    />
  );
});

/**
 * GPU-composited playhead — isolated from parent re-renders.
 * Uses direct clock subscription + transform: translateX so there are
 * zero React re-renders while playing. The caret and line are children
 * of the transform wrapper.
 */
function TimelinePlayhead({
  zoom,
  seek,
  xToTime,
  scrollRef,
}: {
  zoom: number;
  seek: (t: number) => void;
  xToTime: (clientX: number) => number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  /* The playhead is rendered OUTSIDE the lanes' scroll container (in a
     viewport-anchored overlay), so vertical scroll never affects it.
     Horizontal positioning subtracts the lane panel's scrollLeft so the
     playhead stays aligned with the lane content as the user scrolls
     horizontally. */
  useEffect(() => {
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const sx = scrollRef.current?.scrollLeft ?? 0;
      el.style.transform = `translateX(${clock.time() * zoom - sx}px)`;
    };
    apply();
    const unsubClock = clock.subscribe(apply);
    const sc = scrollRef.current;
    sc?.addEventListener("scroll", apply, { passive: true });
    return () => {
      unsubClock();
      sc?.removeEventListener("scroll", apply);
    };
  }, [zoom, scrollRef]);

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const move = (ev: MouseEvent) => seek(xToTime(ev.clientX));
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    },
    [seek, xToTime],
  );

  return (
    <div
      ref={ref}
      className="absolute"
      style={{
        top: 0,
        bottom: 0,
        left: 0,
        width: 13,
        zIndex: 25,
        cursor: "ew-resize",
        willChange: "transform",
        pointerEvents: "auto",
      }}
      onMouseDown={startDrag}
    >
      {/* Caret */}
      <div
        style={{
          position: "absolute",
          top: DESK_SPACER_H,
          left: 0,
          transform: "translateX(-50%)",
          width: 24,
          height: 14,
          pointerEvents: "auto",
          cursor: "ew-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseDown={startDrag}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ display: "block" }}>
          <path d="M0,0 H12 V7 L6,12 L0,7 Z" fill="var(--color-ae-red)" />
        </svg>
      </div>
      {/* Visual line */}
      <div
        style={{
          position: "absolute",
          top: DESK_SPACER_H + 12,
          bottom: 0,
          left: 0,
          width: 1,
          background: "var(--color-ae-red)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

/**
 * Unified mobile playhead — single caret + line spanning the ruler and the
 * track stack. Lives in screen space (outside the horizontal scrollers) and
 * computes its X from clock time minus the shared scrollLeft.
 */
function MobileUnifiedPlayhead({
  zoom,
  rulerRef,
  scrollLeftRef,
  leftOffset,
}: {
  zoom: number;
  rulerRef: React.RefObject<HTMLDivElement | null>;
  scrollLeftRef: React.MutableRefObject<number>;
  leftOffset: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      el.style.transform = `translateX(${clock.time() * zoom - scrollLeftRef.current}px)`;
    };
    update();
    const unsub = clock.subscribe(update);
    const ruler = rulerRef.current;
    ruler?.addEventListener("scroll", update, { passive: true });
    return () => {
      unsub();
      ruler?.removeEventListener("scroll", update);
    };
  }, [zoom, rulerRef, scrollLeftRef]);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute"
      style={{
        top: 0,
        bottom: 0,
        left: leftOffset,
        width: 1,
        zIndex: 25,
        willChange: "transform",
      }}
    >
      {/* Caret — bottom-aligned to ruler so its tip meets the line top */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        style={{
          position: "absolute",
          top: MOB_RULER_H - 14,
          left: 0,
          transform: "translateX(-50%)",
          display: "block",
        }}
      >
        <path d="M0,0 H14 V8 L7,14 L0,8 Z" fill="var(--color-ae-red)" />
      </svg>
      {/* Continuous line through the track stack */}
      <div
        style={{
          position: "absolute",
          top: MOB_RULER_H,
          bottom: 0,
          left: 0,
          width: 1,
          background: "var(--color-ae-red)",
          boxShadow: "0 0 0 0.5px rgba(255,59,48,0.4)",
        }}
      />
    </div>
  );
}

/* Compact row height when a track is collapsed — header only, no clip lane. */
const DESK_TRACK_HEIGHT_COLLAPSED = 52;

function DesktopTrackHeader({
  track,
  index,
  canMoveUp,
  canMoveDown,
  onUpdate,
  isCollapsed = false,
}: {
  track: Track;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUpdate: (p: Partial<Track>) => void;
  isCollapsed?: boolean;
}) {
  const config = useTimelineConfig();
  const [gainDb, setGainDb] = useState(0);
  const [pan, setPan] = useState(0);
  useLayoutEffect(() => {
    config.onTrackGainChange?.(track.id, dbToGain(gainDb));
    // Pan would be set here if supported
  }, [config, track.id, gainDb, pan]);

  const moveTrack = useEditor((s) => s.moveTrack);
  const duplicateTrack = useEditor((s) => s.duplicateTrack);
  const removeTrack = useEditor((s) => s.removeTrack);
  const setSelectedTrack = useEditor((s) => s.setSelectedTrack);
  const isSelected = useEditor((s) => s.selectedTrackId === track.id);
  const seek = useEditor((s) => s.seek);

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dbReadout = formatDb(gainDb);
  const placeholderName = `Track ${index + 1}`;

  const focusName = useCallback(() => {
    const el = nameInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  /* Import-from-disk: pick file(s), probe, and lay them back-to-back on
     this track starting at the playhead so multi-file imports don't all
     stack at the same start position. */
  const onFilesPicked = useCallback(
    (files: FileList | null) =>
      importFiles(files, config, {
        trackId: track.id,
        startAt: clock.time(),
        onFirstClipPlaced: seek,
      }),
    [config, track.id, seek],
  );

  const HEADER_WIDTH = isCollapsed ? 60 : DESK_HEADER_W;

  const rowBg = "transparent";
  const baseShellStyle: React.CSSProperties = {
    width: HEADER_WIDTH,
    minWidth: HEADER_WIDTH,
    background: rowBg,
    borderRight: "1px solid rgba(255,255,255,0.03)",
    boxShadow: "none",
    position: "relative",
    transition: "width 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
    overflow: "hidden",
  };

  /* 3 px left-edge stripe — light gray, shown only on the selected
     track. Tracks themselves carry no color identity in the UI;
     individual clips own their colors. */
  const colorStripe = isSelected ? (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        background: "rgba(255,255,255,0.6)",
      }}
    />
  ) : null;

  if (isCollapsed) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{
          ...baseShellStyle,
          height: track.collapsed ? DESK_TRACK_HEIGHT_COLLAPSED : DESK_TRACK_HEIGHT,
          gap: 12,
        }}
        onMouseDown={() => setSelectedTrack(track.id)}
      >
        {colorStripe}
        <div className="flex flex-col items-center gap-2" style={{ opacity: 0.8 }}>
          <DeskTextBtn
            label="S"
            on={track.soloed}
            tone="solo"
            onClick={() => onUpdate({ soloed: !track.soloed })}
            title={track.soloed ? "Unsolo" : "Solo"}
          />
          <DeskTextBtn
            label="M"
            on={track.muted}
            tone="mute"
            onClick={() => onUpdate({ muted: !track.muted })}
            title={track.muted ? "Unmute" : "Mute"}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdate({ locked: !track.locked });
            }}
            title={track.locked ? "Unlock track" : "Lock track"}
            className="flex items-center justify-center transition-colors ae-ease"
            style={{
              width: 18,
              height: 18,
              borderRadius: 3,
              border: "none",
              background: "transparent",
              color: "white",
              opacity: track.locked ? 0.7 : 0.25,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              if (!track.locked) e.currentTarget.style.opacity = "0.5";
            }}
            onMouseLeave={(e) => {
              if (!track.locked) e.currentTarget.style.opacity = "0.25";
            }}
          >
            {track.locked ? <LockClosed width={14} height={14} strokeWidth={2.2} /> : <LockOpen width={14} height={14} strokeWidth={2.2} />}
          </button>
        </div>
      </div>
    );
  }

  const chevron = (
    <CollapseChevron
      collapsed={track.collapsed}
      onClick={() => onUpdate({ collapsed: !track.collapsed })}
    />
  );

  const nameInput = (
    <input
      ref={nameInputRef}
      value={track.name}
      placeholder={placeholderName}
      spellCheck={false}
      onChange={(e) => onUpdate({ name: e.target.value })}
      onFocus={() => setSelectedTrack(track.id)}
      className="bg-transparent text-white outline-none truncate"
      style={{
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: -0.1,
        minWidth: 0,
        flex: 1,
        padding: 0,
      }}
    />
  );

  const kebab = (
    <TrackKebabMenu
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      onRename={focusName}
      onMoveUp={() => moveTrack(track.id, "up")}
      onMoveDown={() => moveTrack(track.id, "down")}
      onImportFromDisk={() => fileInputRef.current?.click()}
      onDuplicate={() => duplicateTrack(track.id)}
      onDelete={() => removeTrack(track.id)}
    />
  );

  /* Hidden file input — driven by the menu's "Import from Disk" item. */
  const filePicker = (
    <input
      ref={fileInputRef}
      type="file"
      accept={config.fileInputAccept}
      multiple
      style={{ display: "none" }}
      onChange={(e) => {
        void onFilesPicked(e.currentTarget.files);
        e.currentTarget.value = "";
      }}
    />
  );

  if (track.collapsed) {
    /* Collapsed row — chevron + name + kebab + S/M, single line. */
    return (
      <div
        className="flex items-center"
        style={{
          ...baseShellStyle,
          height: DESK_TRACK_HEIGHT_COLLAPSED,
          flexShrink: 0,
          padding: "0 10px 0 12px",
          gap: 7,
        }}
        onMouseDown={() => setSelectedTrack(track.id)}
      >
        {colorStripe}
        {chevron}
        {nameInput}
        <span
          className="font-ae-mono tabular-nums"
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.45)",
            flexShrink: 0,
          }}
        >
          {dbReadout}
        </span>
        {kebab}
        <div className="flex items-center" style={{ gap: 3, flexShrink: 0 }}>
          <DeskTextBtn
            label="S"
            on={track.soloed}
            tone="solo"
            onClick={() => onUpdate({ soloed: !track.soloed })}
            title={track.soloed ? "Unsolo" : "Solo"}
          />
          <DeskTextBtn
            label="M"
            on={track.muted}
            tone="mute"
            onClick={() => onUpdate({ muted: !track.muted })}
            title={track.muted ? "Unmute" : "Mute"}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdate({ locked: !track.locked });
            }}
            title={track.locked ? "Unlock track" : "Lock track"}
            className="flex items-center justify-center transition-colors ae-ease"
            style={{
              width: 18,
              height: 18,
              borderRadius: 3,
              border: "none",
              background: "transparent",
              color: "white",
              opacity: track.locked ? 0.7 : 0.25,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              if (!track.locked) e.currentTarget.style.opacity = "0.5";
            }}
            onMouseLeave={(e) => {
              if (!track.locked) e.currentTarget.style.opacity = "0.25";
            }}
          >
            {track.locked ? <LockClosed width={14} height={14} strokeWidth={2.2} /> : <LockOpen width={14} height={14} strokeWidth={2.2} />}
          </button>
        </div>
        {filePicker}
      </div>
    );
  }

  return (
    <div
      className="flex relative"
      style={{
        ...baseShellStyle,
        height: DESK_TRACK_HEIGHT,
        flexShrink: 0,
        padding: "8px 6px 8px 10px",
      }}
      onMouseDown={() => setSelectedTrack(track.id)}
    >
      {colorStripe}

      <div className="flex-1 flex flex-col justify-between ml-1 min-w-0 pr-2">
        {/* Row 1 — Title + M/S */}
        <div className="flex items-center justify-between" style={{ minWidth: 0 }}>
          <div className="flex items-center min-w-0" style={{ flex: 1, marginRight: 6 }}>
            {nameInput}
          </div>
          
          <div className="flex items-center" style={{ gap: 6, flexShrink: 0 }}>
            <DeskTextBtn
              label="M"
              on={track.muted}
              tone="mute"
              onClick={() => onUpdate({ muted: !track.muted })}
              title={track.muted ? "Unmute" : "Mute"}
            />
            <DeskTextBtn
              label="S"
              on={track.soloed}
              tone="solo"
              onClick={() => onUpdate({ soloed: !track.soloed })}
              title={track.soloed ? "Unsolo" : "Solo"}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ locked: !track.locked });
              }}
              title={track.locked ? "Unlock track" : "Lock track"}
              className="flex items-center justify-center transition-colors ae-ease"
              style={{
                width: 18,
                height: 18,
                borderRadius: 3,
                border: "none",
                background: "transparent",
                color: "white",
                opacity: track.locked ? 0.7 : 0.25,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (!track.locked) e.currentTarget.style.opacity = "0.5";
              }}
              onMouseLeave={(e) => {
                if (!track.locked) e.currentTarget.style.opacity = "0.25";
              }}
            >
              {track.locked ? <LockClosed width={14} height={14} strokeWidth={2.2} /> : <LockOpen width={14} height={14} strokeWidth={2.2} />}
            </button>
            {kebab}
          </div>
        </div>

        {/* Row 2 — VOL */}
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.3)", width: 24, letterSpacing: 0.3 }}>VOL</span>
          <input
            type="range"
            min={-40}
            max={6}
            step={0.1}
            value={gainDb}
            onChange={(e) => setGainDb(parseFloat(e.target.value))}
            className="ae-volume-slider flex-1"
            title={`Gain ${dbReadout} dB`}
          />
          <span
            className="font-ae-mono tabular-nums text-right"
            style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", width: 28 }}
          >
            {dbReadout}
          </span>
        </div>

        {/* Row 3 — PAN */}
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.3)", width: 24, letterSpacing: 0.3 }}>PAN</span>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.1}
            value={pan}
            onChange={(e) => setPan(parseFloat(e.target.value))}
            className="ae-pan-slider flex-1"
            title={`Pan ${pan === 0 ? "C" : pan.toFixed(1)}`}
          />
          <span
            className="font-ae-mono tabular-nums text-right"
            style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", width: 28 }}
          >
            {pan === 0 ? "C" : pan > 0 ? `R${Math.round(pan * 100)}` : `L${Math.round(-pan * 100)}`}
          </span>
        </div>
      </div>

      {/* Vertical Meter — kind-specific (audio renders a level meter, video
          typically returns null and the column collapses). */}
      {config.renderTrackMeter && (
        <div style={{ width: 6, height: "100%", padding: "6px 0", flexShrink: 0 }}>
          {config.renderTrackMeter(track)}
        </div>
      )}

      {filePicker}
    </div>
  );
}

/* Disclosure chevron — rotates 0° (expanded) / 0° base (collapsed → points
   right). Following Apple/Finder convention: chevron on the left edge,
   pointing right when collapsed and down when expanded. */
function CollapseChevron({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? "Expand track" : "Collapse track"}
      aria-label={collapsed ? "Expand track" : "Collapse track"}
      aria-expanded={!collapsed}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 18,
        height: 18,
        flexShrink: 0,
        borderRadius: 4,
        border: "none",
        background: "transparent",
        color: hover ? "white" : "rgba(255,255,255,0.55)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        transition: "color 0.12s",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
          transition: "transform 0.18s cubic-bezier(0.2,0.8,0.2,1)",
        }}
      >
        <ChevronRight width={14} height={14} />
      </span>
    </button>
  );
}

/* Solo / Mute — plain text, no borders, no background. Color-only state. */
function DeskTextBtn({
  label,
  on,
  tone,
  onClick,
  title,
}: {
  label: "S" | "M";
  on: boolean;
  tone: "solo" | "mute";
  onClick: () => void;
  title: string;
}) {
  const onColor = tone === "solo" ? "var(--color-ae-yellow)" : "var(--color-ae-red)";
  const offColor = "rgba(255,255,255,0.3)";
  
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 18,
        height: 18,
        borderRadius: 3,
        border: "none",
        background: "transparent",
        color: on ? onColor : offColor,
        fontSize: 11,
        fontWeight: 600,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        transition: "color 0.12s",
      }}
      onMouseEnter={(e) => {
        if (on) return;
        (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
      }}
      onMouseLeave={(e) => {
        if (on) return;
        (e.currentTarget as HTMLElement).style.color = offColor;
      }}
    >
      {label}
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════════ */
/* MOBILE                                                               */
/* Stacked layout: header (full-width, doesn't scroll horizontally) on  */
/* top of lane (scrolls horizontally; all lanes synced). Clips: dark    */
/* body, white waveform, top-edge color stripe.                         */
/* ════════════════════════════════════════════════════════════════════ */

const MOB_TRACK_LANE_H = 96;
const MOB_RULER_H = 36;
/* Width of the per-row leading column showing track identity (color + index). */
const MOB_LEFT_RAIL_W = 36;
/* Height of the floating master/focused-track control strip, sitting above the ruler. */
const MOB_STRIP_H = 56;

function MobileTimeline({ mode }: { mode: EditorMode }) {
  const config = useTimelineConfig();
  const tracks = useEditor((s) => s.tracks);
  const clips = useEditor((s) => s.clips);
  const clipOrder = useEditor((s) => s.clipOrder);
  const total = useEditor((s) => s.totalDuration());
  const seek = useEditor((s) => s.seek);
  const zoom = useEditor((s) => s.zoom);
  const selectedClipId = useEditor((s) => s.selectedClipId);
  const setSelectedClip = useEditor((s) => s.setSelectedClip);
  const moveClip = useEditor((s) => s.moveClip);
  const trimClipStart = useEditor((s) => s.trimClipStart);
  const trimClipEnd = useEditor((s) => s.trimClipEnd);
  const commitClipEdit = useEditor((s) => s.commitClipEdit);
  const updateTrack = useEditor((s) => s.updateTrack);

  const visibleTracks = useMemo(
    () => tracks.filter((t) => t.kind === config.kind),
    [tracks, config.kind],
  );

  /* Focused track: the one whose controls are surfaced in the master strip.
     Updated when the user selects a clip (handleSelectClip) or taps a row
     badge; falls back to the first visible track if unset / removed. */
  const [focusedTrackId, setFocusedTrackId] = useState<string | null>(null);
  const effectiveFocusedTrackId =
    focusedTrackId && visibleTracks.some((t) => t.id === focusedTrackId)
      ? focusedTrackId
      : visibleTracks[0]?.id ?? null;
  const handleSelectClip = useCallback(
    (clipId: string) => {
      setSelectedClip(clipId);
      const c = clips[clipId];
      if (c) setFocusedTrackId(c.trackId);
    },
    [clips, setSelectedClip],
  );

  const scrollersRef = useRef<HTMLDivElement[]>([]);
  /* One ref per track — the outer row div; used for cross-track hit-testing. */
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isSyncing = useRef(false);
  const sharedScrollLeft = useRef(0);

  const registerScroller = useCallback((idx: number) => {
    return (el: HTMLDivElement | null) => {
      if (el) {
        scrollersRef.current[idx] = el;
        if (el.scrollLeft !== sharedScrollLeft.current) {
          el.scrollLeft = sharedScrollLeft.current;
        }
      }
    };
  }, []);

  const onScrollSync = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncing.current) {
      isSyncing.current = false;
      return;
    }
    const sl = e.currentTarget.scrollLeft;
    sharedScrollLeft.current = sl;
    isSyncing.current = true;
    let pending = 0;
    /* `scrollersRef.current` is the array of registered scroll containers.
       We're not mutating the ref itself or its array; we're writing to the
       DOM property of each element — but the linter conservatively flags
       any property write through a ref-reached value, so we silence it. */
    for (const el of scrollersRef.current) {
      if (el && el !== e.currentTarget && el.scrollLeft !== sl) {
        // eslint-disable-next-line react-hooks/immutability
        el.scrollLeft = sl;
        pending++;
      }
    }
    if (pending === 0) isSyncing.current = false;
  }, []);

  /**
   * Mirrors the desktop timeline: see DesktopTimeline for the full
   * comment on the drag-spawn-new-track state machine.
   */
  const dragCreatedTrackRef = useRef<string | null>(null);
  const [newlyCreatedTrackId, setNewlyCreatedTrackId] = useState<string | null>(
    null,
  );
  const [dropHintActive, setDropHintActive] = useState(false);
  const NEW_TRACK_COMMIT_PX = 24;

  const resolveTrackAtY = useCallback(
    (clientY: number): string | undefined => {
      const tracks = useEditor
        .getState()
        .tracks.filter((t) => t.kind === config.kind);
      for (let i = 0; i < tracks.length; i++) {
        const el = rowRefs.current[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientY >= rect.top && clientY < rect.bottom) {
          setDropHintActive(false);
          return tracks[i].id;
        }
      }
      if (tracks.length === 0) {
        setDropHintActive(false);
        return undefined;
      }
      const lastEl = rowRefs.current[tracks.length - 1];
      if (!lastEl) return dragCreatedTrackRef.current ?? undefined;
      const lastBottom = lastEl.getBoundingClientRect().bottom;
      if (clientY < lastBottom) {
        setDropHintActive(false);
        return undefined;
      }
      setDropHintActive(true);
      if (dragCreatedTrackRef.current) return dragCreatedTrackRef.current;
      if (clientY < lastBottom + NEW_TRACK_COMMIT_PX) return undefined;
      const newId = useEditor.getState().addTrack(config.kind);
      dragCreatedTrackRef.current = newId;
      setNewlyCreatedTrackId(newId);
      window.setTimeout(() => {
        setNewlyCreatedTrackId((curr) => (curr === newId ? null : curr));
      }, 260);
      return newId;
    },
    [config.kind],
  );

  const handleClipDragEnd = useCallback(() => {
    const created = dragCreatedTrackRef.current;
    dragCreatedTrackRef.current = null;
    setDropHintActive(false);
    if (!created) return;
    const state = useEditor.getState();
    const hasClips = Object.values(state.clips).some(
      (c) => c.trackId === created,
    );
    if (!hasClips) state.removeTrack(created);
  }, []);

  const rulerRef = useRef<HTMLDivElement | null>(null);
  const scrubbing = useRef(false);
  const xToTime = useCallback(
    (clientX: number): number => {
      const el = rulerRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left + el.scrollLeft;
      return Math.max(0, x / zoom);
    },
    [zoom],
  );
  const beginScrub = (e: React.MouseEvent) => {
    e.preventDefault();
    scrubbing.current = true;
    seek(xToTime(e.clientX));
    const onMove = (ev: MouseEvent) => {
      if (!scrubbing.current) return;
      seek(xToTime(ev.clientX));
    };
    const onUp = () => {
      scrubbing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  /* Auto-scroll: direct clock subscription — no React re-render. */
  const zoomRefMob = useRef(zoom);
  useEffect(() => { zoomRefMob.current = zoom; }, [zoom]);
  useEffect(() => {
    const unsub = clock.subscribe(() => {
      if (!clock.playing()) return;
      const playheadX = clock.time() * zoomRefMob.current;
      const lead = scrollersRef.current.find(Boolean);
      if (!lead) return;
      const visStart = lead.scrollLeft;
      const visEnd = lead.scrollLeft + lead.clientWidth;
      let target: number | null = null;
      if (playheadX > visEnd - lead.clientWidth * 0.2) {
        target = Math.max(0, playheadX - lead.clientWidth * 0.5);
      } else if (playheadX < visStart) {
        target = Math.max(0, playheadX - lead.clientWidth * 0.1);
      }
      if (target == null) return;
      sharedScrollLeft.current = target;
      isSyncing.current = true;
      let pending = 0;
      for (const el of scrollersRef.current) {
        if (el && el.scrollLeft !== target) {
          el.scrollLeft = target;
          pending++;
        }
      }
      if (pending === 0) isSyncing.current = false;
    });
    return unsub;
  }, []);

  const contentWidth = Math.max(800, total * zoom + 200);
  /* The empty state is the canonical "nothing on the timeline yet" affordance,
     so it fires whenever there are no clips — the default project ships with
     one audio track, so checking tracks alone would never surface it. */
  const showEmptyState = clipOrder.length === 0;

  const focusedTrack = visibleTracks.find((t) => t.id === effectiveFocusedTrackId) ?? null;
  const cycleFocusedTrack = () => {
    if (visibleTracks.length < 2) return;
    const idx = visibleTracks.findIndex((t) => t.id === effectiveFocusedTrackId);
    const next = visibleTracks[(idx + 1) % visibleTracks.length];
    setFocusedTrackId(next.id);
  };

  return (
    <div
      className="flex-1 min-w-0 flex flex-col relative"
      style={{ background: "var(--color-ae-bg)", overflow: "hidden" }}
    >
      <MobileTrackStrip
        track={focusedTrack}
        index={focusedTrack ? visibleTracks.findIndex((t) => t.id === focusedTrack.id) : -1}
        trackCount={visibleTracks.length}
        onCycle={cycleFocusedTrack}
        onUpdate={(p) => focusedTrack && updateTrack(focusedTrack.id, p)}
      />

      <div className="relative flex-1 flex flex-col" style={{ minHeight: 0 }}>
        <div className="flex" style={{ flexShrink: 0 }}>
          <div
            aria-hidden="true"
            style={{
              width: MOB_LEFT_RAIL_W,
              height: MOB_RULER_H,
              borderBottom: "1px solid var(--color-ae-border)",
              borderRight: "1px solid var(--color-ae-border)",
              background: "var(--color-ae-bg)",
              flexShrink: 0,
            }}
          />
          <div
            ref={(el) => {
              rulerRef.current = el;
              registerScroller(0)(el);
            }}
            onScroll={onScrollSync}
            onMouseDown={beginScrub}
            className="ae-no-scrollbar"
            style={{
              flex: 1,
              minWidth: 0,
              height: MOB_RULER_H,
              overflowX: "auto",
              overflowY: "hidden",
              borderBottom: "1px solid var(--color-ae-border)",
              cursor: "ew-resize",
            }}
          >
            <div style={{ width: contentWidth, height: "100%", position: "relative", overflow: "hidden" }}>
              <MobileRulerTicks total={total} zoom={zoom} scrollContainerRef={rulerRef} />
            </div>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto scrollbar-dark"
          style={{ paddingBottom: 120 }}
        >
          {visibleTracks.map((tr, i) => (
            <MobileTrackRow
              key={tr.id}
              track={tr}
              mode={mode}
              index={i}
              contentWidth={contentWidth}
              zoom={zoom}
              isNewlyCreated={newlyCreatedTrackId === tr.id}
              clips={clipOrder
                .map((id) => clips[id])
                .filter((c): c is Clip => !!c && c.trackId === tr.id)}
              selectedClipId={selectedClipId}
              focused={tr.id === effectiveFocusedTrackId}
              onFocus={() => setFocusedTrackId(tr.id)}
              onSelect={handleSelectClip}
              onMove={(id, t, tid) => moveClip(id, t, tid)}
              onTrimStart={trimClipStart}
              onTrimEnd={trimClipEnd}
              registerScroller={registerScroller(i + 1)}
              onScrollSync={onScrollSync}
              registerRow={(el) => { rowRefs.current[i] = el; }}
              resolveTrackAtY={resolveTrackAtY}
              onDragEnd={(id) => { commitClipEdit(id); handleClipDragEnd(); }}
            />
          ))}
          {dropHintActive && (
            <div
              className="ae-drop-hint"
              style={{
                height: MOB_TRACK_LANE_H - 8,
                margin: "4px 8px",
              }}
            />
          )}
          {showEmptyState && <EmptyState />}
        </div>

        <MobileUnifiedPlayhead
          zoom={zoom}
          rulerRef={rulerRef}
          scrollLeftRef={sharedScrollLeft}
          leftOffset={MOB_LEFT_RAIL_W}
        />
      </div>
    </div>
  );
}

/** Canvas-based mobile ruler — same pattern as desktop. */
/** Scroll-aware canvas mobile ruler — same viewport-only approach as desktop. */
const MobileRulerTicks = memo(function MobileRulerTicks({
  total,
  zoom,
  scrollContainerRef,
}: {
  total: number;
  zoom: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const totalRef = useLatest(total);
  const zoomRef = useLatest(zoom);

  const draw = useCallback(() => {
    const cvs = canvasRef.current;
    const container = scrollContainerRef.current;
    if (!cvs || !container) return;

    const scrollLeft = container.scrollLeft;
    const viewWidth = container.clientWidth;
    if (viewWidth <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasW = viewWidth + 100;
    const h = MOB_RULER_H;
    const z = zoomRef.current;
    const tot = totalRef.current;

    const targetW = Math.round(canvasW * dpr);
    const targetH = Math.round(h * dpr);
    if (cvs.width !== targetW || cvs.height !== targetH) {
      cvs.width = targetW;
      cvs.height = targetH;
      cvs.style.width = `${canvasW}px`;
      cvs.style.height = `${h}px`;
    }

    cvs.style.transform = `translateX(${scrollLeft}px)`;

    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasW, h);

    const targetPxPerLabel = 90;
    let interval = targetPxPerLabel / z;
    for (const s of [0.1, 0.2, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600]) {
      if (s >= interval) { interval = s; break; }
    }

    const startT = Math.max(0, Math.floor((scrollLeft / z) / interval) * interval);
    const endT = Math.min(tot + interval, (scrollLeft + canvasW) / z + interval);

    ctx.font = "11px ui-monospace, SFMono-Regular, monospace";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let t = startT; t <= endT; t += interval) {
      const x = t * z - scrollLeft;
      if (x < -60 || x > canvasW + 10) continue;
      ctx.fillText(fmtMobileTime(t), x + 4, h / 2);
    }
    /* totalRef/zoomRef are stable; listed for the linter so it can verify
       the closure reads them. */
  }, [scrollContainerRef, totalRef, zoomRef]);

  useEffect(() => { draw(); }, [total, zoom, draw]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener("scroll", draw);
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", draw);
      ro.disconnect();
    };
  }, [scrollContainerRef, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none"
      style={{ position: "absolute", top: 0, left: 0, willChange: "transform" }}
    />
  );
});

function fmtMobileTime(t: number): string {
  if (t === 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function MobileTrackRow({
  track,
  mode,
  index,
  contentWidth,
  zoom,
  clips,
  selectedClipId,
  focused,
  onFocus,
  onSelect,
  onMove,
  onTrimStart,
  onTrimEnd,
  registerScroller,
  onScrollSync,
  registerRow,
  resolveTrackAtY,
  onDragEnd,
  isNewlyCreated,
}: {
  track: Track;
  mode: EditorMode;
  index: number;
  contentWidth: number;
  zoom: number;
  clips: Clip[];
  selectedClipId: string | null;
  focused: boolean;
  onFocus: () => void;
  onSelect: (id: string) => void;
  onMove: (id: string, t: number, trackId?: string) => void;
  onTrimStart: (id: string, t: number) => void;
  onTrimEnd: (id: string, t: number) => void;
  registerScroller: (el: HTMLDivElement | null) => void;
  onScrollSync: (e: React.UIEvent<HTMLDivElement>) => void;
  registerRow?: (el: HTMLDivElement | null) => void;
  resolveTrackAtY?: (clientY: number) => string | undefined;
  onDragEnd?: (clipId: string) => void;
  isNewlyCreated?: boolean;
}) {
  const { ClipBlock } = useTimelineConfig();
  return (
    <div
      ref={registerRow}
      className={isNewlyCreated ? "flex ae-track-lane-in" : "flex"}
      style={{
        borderBottom: "1px solid var(--color-ae-border)",
        opacity: track.locked ? 0.6 : 1,
        position: "relative",
      }}
    >
      {/* Leading badge — track identity + tap-to-focus. */}
      <button
        type="button"
        onClick={onFocus}
        aria-label={`Focus track ${index + 1}`}
        aria-pressed={focused}
        style={{
          width: MOB_LEFT_RAIL_W,
          height: MOB_TRACK_LANE_H,
          flexShrink: 0,
          padding: 0,
          border: "none",
          borderRight: "1px solid var(--color-ae-border)",
          background: focused ? "rgba(255,255,255,0.04)" : "var(--color-ae-bg)",
          cursor: "pointer",
          position: "relative",
          color: "rgba(255,255,255,0.7)",
          fontSize: 12,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {focused && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              background: "rgba(255,255,255,0.6)",
            }}
          />
        )}
        <span style={{ opacity: focused ? 1 : 0.7 }}>{index + 1}</span>
      </button>

      <div
        ref={registerScroller}
        onScroll={onScrollSync}
        className="ae-no-scrollbar"
        style={{
          flex: 1,
          minWidth: 0,
          height: MOB_TRACK_LANE_H,
          overflowX: "auto",
          overflowY: "hidden",
          background: "transparent",
        }}
      >
        <div
          style={{
            position: "relative",
            width: contentWidth,
            height: "100%",
          }}
        >
          {!track.locked &&
            computeGaps(clips).map((g) => (
              <GapBlock
                key={`${track.id}-${g.start.toFixed(4)}-${g.end.toFixed(4)}`}
                gap={g}
                trackId={track.id}
                zoom={zoom}
                variant="mobile"
              />
            ))}
          {clips.map((c) => (
            <ClipBlock
              key={c.id}
              mode={mode}
              clip={c}
              zoom={zoom}
              locked={track.locked}
              selected={selectedClipId === c.id}
              variant="mobile"
              onSelect={() => onSelect(c.id)}
              onMove={(t, tid) => onMove(c.id, t, tid)}
              onTrimStart={(t) => onTrimStart(c.id, t)}
              onTrimEnd={(t) => onTrimEnd(c.id, t)}
              resolveTrackAtY={resolveTrackAtY}
              onDragEnd={() => onDragEnd?.(c.id)}
            />
          ))}
        </div>
      </div>

      {clips.length === 0 && !track.locked && (
        <MobileEmptyLane trackId={track.id} />
      )}
    </div>
  );
}

/**
 * Per-track tap-to-add dropzone. Overlays the empty lane area on mobile,
 * mirroring the desktop TrackEmptyLane's dashed-box visual but without DnD.
 */
function MobileEmptyLane({ trackId }: { trackId: string }) {
  const config = useTimelineConfig();
  const seek = useEditor((s) => s.seek);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const runImport = useCallback(
    (files: FileList | null) =>
      importFiles(files, config, {
        trackId,
        startAt: clock.time(),
        onFirstClipPlaced: seek,
      }),
    [config, trackId, seek],
  );

  // Outer fills the entire track row (top:0, bottom:0) so its bounds align
  // with the left rail; padding gives the inner bordered box its breathing
  // room without pushing the row geometry. Mobile drops hover/drag affordances.
  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      style={{
        position: "absolute",
        left: MOB_LEFT_RAIL_W + 12,
        right: 12,
        top: 0,
        bottom: 0,
        padding: "10px 0",
        cursor: "pointer",
        zIndex: 2,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.09)",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          color: "rgba(255,255,255,0.5)",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" fill="currentColor" />
        </svg>
        <span
          style={{
            fontSize: 12,
            fontWeight: 400,
            letterSpacing: 0.2,
            pointerEvents: "none",
          }}
        >
          {config.copy.mobileLaneHint}
        </span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={config.fileInputAccept}
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          void runImport(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * Master strip — the single mixer surface on mobile. Shows controls for the
 * focused track (label + M/S/Volume); tap the label to cycle to the next
 * track. Per-track gain is remembered in a ref keyed by track id so switching
 * focus restores the slider to the value the user last set for that track.
 */
function MobileTrackStrip({
  track,
  index,
  trackCount,
  onCycle,
  onUpdate,
}: {
  track: Track | null;
  index: number;
  trackCount: number;
  onCycle: () => void;
  onUpdate: (p: Partial<Track>) => void;
}) {
  const config = useTimelineConfig();
  const gainByTrack = useRef<Map<string, number>>(new Map());
  const [gainPct, setGainPct] = useState(80);
  const trackId = track?.id ?? null;

  useEffect(() => {
    if (!trackId) return;
    const remembered = gainByTrack.current.get(trackId) ?? 80;
    // Restoring per-track gain on track switch — derived from a ref cache,
    // not from props, so it has to live in state and be synced via effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGainPct(remembered);
  }, [trackId]);

  useLayoutEffect(() => {
    if (!trackId) return;
    gainByTrack.current.set(trackId, gainPct);
    config.onTrackGainChange?.(trackId, gainPct / 100);
  }, [config, trackId, gainPct]);

  const empty = !track;

  return (
    <div
      className="flex items-center"
      style={{
        height: MOB_STRIP_H,
        padding: "0 16px",
        gap: 14,
        background: "var(--color-ae-bg)",
        borderBottom: "1px solid var(--color-ae-border)",
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={onCycle}
        disabled={empty || trackCount < 2}
        aria-label="Switch focused track"
        title={trackCount > 1 ? "Tap to switch focused track" : undefined}
        className="flex items-center"
        style={{
          gap: 10,
          minWidth: 0,
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
          color: "rgba(255,255,255,0.95)",
          cursor: empty || trackCount < 2 ? "default" : "pointer",
          textAlign: "left",
          flexShrink: 0,
          maxWidth: 180,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: track ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)",
            flexShrink: 0,
          }}
        />
        <span
          className="truncate"
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-0.005em",
          }}
        >
          {empty ? "No track" : `Track ${index + 1}`}
        </span>
      </button>

      <div className="flex items-center" style={{ gap: 8 }}>
        <MobMSBtn
          label="M"
          on={!!track?.muted}
          disabled={empty}
          onClick={() => track && onUpdate({ muted: !track.muted })}
        />
        <MobMSBtn
          label="S"
          on={!!track?.soloed}
          disabled={empty}
          onClick={() => track && onUpdate({ soloed: !track.soloed })}
        />
      </div>

      <div className="flex items-center" style={{ gap: 10, flex: 1, minWidth: 0 }}>
        <span style={{ color: "rgba(255,255,255,0.85)", display: "inline-flex" }}>
          <VolumeUp width={20} height={20} />
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={gainPct}
          disabled={empty}
          onChange={(e) => setGainPct(parseFloat(e.target.value))}
          className="ae-volume-slider"
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>
    </div>
  );
}

function MobMSBtn({
  label,
  on,
  onClick,
  disabled = false,
}: {
  label: "M" | "S";
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const onColor =
    label === "M" ? "var(--color-ae-red)" : "var(--color-ae-yellow)";
  const glow = label === "M" ? "rgba(255,59,48,0.4)" : "rgba(255,214,10,0.4)";
  const titles = {
    M: on ? "Unmute" : "Mute",
    S: on ? "Unsolo" : "Solo",
  };
  const baseStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 6,
    border: on ? `1px solid ${onColor}` : "1px solid rgba(255,255,255,0.12)",
    background: on ? onColor : "transparent",
    color: on ? (label === "S" ? "black" : "white") : "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? "default" : "pointer",
    transition: "0.2s",
    boxShadow: on ? `0 0 8px ${glow}` : "none",
    opacity: disabled ? 0.4 : 1,
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titles[label]}
      aria-label={titles[label]}
      style={baseStyle}
      onMouseEnter={(e) => {
        if (on || disabled) return;
        (e.currentTarget as HTMLElement).style.borderColor =
          "rgba(255,255,255,0.3)";
      }}
      onMouseLeave={(e) => {
        if (on || disabled) return;
        (e.currentTarget as HTMLElement).style.borderColor =
          "rgba(255,255,255,0.12)";
      }}
    >
      {label}
    </button>
  );
}

/* ── Shared atoms ─────────────────────────────────────────────────── */

/* Empty space between two clips (or before the first clip) on a single
   track. Click selects; Backspace ripples the track left to close it.
   Sub-frame slivers are filtered out by the caller (see GAP_MIN_S). */
type Variant = "desktop" | "mobile";
const GAP_MIN_S = 0.01;

function computeGaps(clips: Clip[]): { start: number; end: number }[] {
  const sorted = clips.slice().sort((a, b) => a.start - b.start);
  const out: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const c of sorted) {
    if (c.start > cursor + GAP_MIN_S) out.push({ start: cursor, end: c.start });
    cursor = Math.max(cursor, c.start + c.duration);
  }
  return out;
}

function GapBlock({
  gap,
  trackId,
  zoom,
  variant,
}: {
  gap: { start: number; end: number };
  trackId: string;
  zoom: number;
  variant: Variant;
}) {
  const setSelectedGap = useEditor((s) => s.setSelectedGap);
  const selected = useEditor(
    (s) =>
      !!s.selectedGap &&
      s.selectedGap.trackId === trackId &&
      Math.abs(s.selectedGap.start - gap.start) < 1e-3 &&
      Math.abs(s.selectedGap.end - gap.end) < 1e-3,
  );

  const left = gap.start * zoom;
  const width = Math.max(2, (gap.end - gap.start) * zoom);
  const inset = variant === "mobile" ? 6 : 6;

  return (
    <div
      role="button"
      aria-label={`Empty gap, ${(gap.end - gap.start).toFixed(2)} seconds. Press Backspace to close.`}
      title={`Gap · ${(gap.end - gap.start).toFixed(2)}s — Backspace to close`}
      onMouseDown={(e) => {
        /* Stop propagation so the lane below doesn't receive a click. */
        e.stopPropagation();
        e.preventDefault();
        setSelectedGap({ trackId, start: gap.start, end: gap.end });
      }}
      style={{
        position: "absolute",
        left,
        width,
        top: inset,
        bottom: inset,
        borderRadius: 8,
        background: selected
          ? "rgba(255,255,255,0.14)"
          : "transparent",
        border: "none",
        cursor: "pointer",
        transition: "background 120ms ease",
        zIndex: 1,
      }}
      onMouseEnter={(e) => {
        if (selected) return;
        const el = e.currentTarget as HTMLElement;
        el.style.background = "rgba(255,255,255,0.07)";
      }}
      onMouseLeave={(e) => {
        if (selected) return;
        const el = e.currentTarget as HTMLElement;
        el.style.background = "transparent";
      }}
    />
  );
}

/* ── Track empty-lane drop zone ──────────────────────────────────── */

function TrackEmptyLane({ trackId, panelWidth }: { trackId: string; panelWidth: number }) {
  const config = useTimelineConfig();
  const seek = useEditor((s) => s.seek);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const runImport = useCallback(
    (files: FileList | null) =>
      importFiles(files, config, {
        trackId,
        startAt: clock.time(),
        onFirstClipPlaced: seek,
      }),
    [config, trackId, seek],
  );

  /* The outer fills the entire lane row top-to-bottom so its bounds match
     the track header on the left rail; the inner bordered box is inset via
     padding instead of margin, so the visible "Drop … here" rectangle keeps
     its breathing room without pushing the row geometry. */
  return (
    <div
      style={{
        position: "sticky",
        left: 12,
        marginLeft: 12,
        width: Math.max(0, panelWidth - 24),
        height: "100%",
        padding: "10px 0",
        cursor: "pointer",
      }}
      onClick={() => fileInputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        void runImport(e.dataTransfer.files);
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 6,
          border: dragOver
            ? "1px dashed rgba(255,255,255,0.35)"
            : "1px solid rgba(255,255,255,0.09)",
          background: dragOver ? "rgba(255,255,255,0.05)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          transition: "background 0.15s, border-color 0.15s, color 0.15s",
          color: dragOver ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.5)",
        }}
        onMouseEnter={(e) => {
          if (dragOver) return;
          e.currentTarget.style.color = "rgba(255,255,255,0.7)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
        }}
        onMouseLeave={(e) => {
          if (dragOver) return;
          e.currentTarget.style.color = "rgba(255,255,255,0.5)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" fill="currentColor" />
        </svg>
        <span
          style={{
            fontSize: 12,
            fontWeight: 400,
            letterSpacing: 0.2,
            pointerEvents: "none",
          }}
        >
          {config.copy.laneHint}
        </span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={config.fileInputAccept}
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          void runImport(e.currentTarget.files);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

type LoopProps = {
  loopIn: number;
  loopOut: number;
  loopEnabled: boolean;
  zoom: number;
  onSetLoopIn: (t: number) => void;
  onSetLoopOut: (t: number) => void;
  onSetLoopEnabled: (b: boolean) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
};

const LOOP_HANDLE_W = 8;
const LOOP_MIN_DUR = 0.05;

function startLoopBodyDrag(
  e: React.MouseEvent,
  loopIn: number,
  loopOut: number,
  zoom: number,
  onSetLoopIn: (t: number) => void,
  onSetLoopOut: (t: number) => void,
  onSetLoopEnabled: (b: boolean) => void,
) {
  e.stopPropagation();
  e.preventDefault();
  onSetLoopEnabled(true);
  const startX = e.clientX;
  const origIn = loopIn;
  const dur = loopOut - loopIn;
  const move = (ev: MouseEvent) => {
    const dx = (ev.clientX - startX) / zoom;
    const newIn = Math.max(0, origIn + dx);
    onSetLoopIn(newIn);
    onSetLoopOut(newIn + dur);
  };
  const up = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
  };
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}

function startLoopEdgeDrag(
  e: React.MouseEvent,
  edge: "left" | "right",
  loopIn: number,
  loopOut: number,
  zoom: number,
  onSetLoopIn: (t: number) => void,
  onSetLoopOut: (t: number) => void,
  onSetLoopEnabled: (b: boolean) => void,
) {
  e.stopPropagation();
  e.preventDefault();
  onSetLoopEnabled(true);
  const startX = e.clientX;
  const origIn = loopIn;
  const origOut = loopOut;
  const move = (ev: MouseEvent) => {
    const dx = (ev.clientX - startX) / zoom;
    if (edge === "left") {
      const next = Math.max(0, origIn + dx);
      if (next >= origOut - LOOP_MIN_DUR) {
        /* Collapsed — clear the loop */
        onSetLoopIn(0);
        onSetLoopOut(0);
        onSetLoopEnabled(false);
      } else {
        onSetLoopIn(next);
      }
    } else {
      const next = origOut + dx;
      if (next <= origIn + LOOP_MIN_DUR) {
        /* Collapsed — clear the loop */
        onSetLoopIn(0);
        onSetLoopOut(0);
        onSetLoopEnabled(false);
      } else {
        onSetLoopOut(next);
      }
    }
  };
  const up = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
  };
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}

function LoopBandFill({ loopIn, loopOut, loopEnabled, zoom, onSetLoopIn, onSetLoopOut, onSetLoopEnabled, onContextMenu }: LoopProps) {
  const left = loopIn * zoom;
  const width = Math.max(1, (loopOut - loopIn) * zoom);
  const r = Math.min(6, width / 2);
  /* Two layers:
       1. Visual fill — spans the full ruler height so the loop region
          reads continuous from the ruler top through the lanes below.
          The fill alpha is intentionally higher than the lane band's
          (0.15 vs 0.08) because the ruler sits on a near-opaque dark
          background while the lane area is transparent over the editor
          surface — same alpha would read much weaker in the ruler and
          visually fragment the band. pointer-events: none lets clicks
          on the upper half fall through to the parent ruler's scrub
          handler.
       2. Click target — confined to the bottom half so the upper half
          remains the scrub zone (the parent ruler's onMouseDown
          discriminates upper-vs-lower based on Y). */
  const fillAlpha = loopEnabled ? 0.15 : 0.08;
  const edgeAlpha = loopEnabled ? 0.6 : 0.2;
  const topAlpha = loopEnabled ? 0.9 : 0.3;
  return (
    <>
      <div
        className="pointer-events-none absolute"
        style={{
          left,
          top: 0,
          bottom: 0,
          width,
          background: `rgba(255, 214, 10, ${fillAlpha})`,
          borderTop: `2px solid rgba(255, 214, 10, ${topAlpha})`,
          borderLeft: `1px solid rgba(255, 214, 10, ${edgeAlpha})`,
          borderRight: `1px solid rgba(255, 214, 10, ${edgeAlpha})`,
          borderRadius: `${r}px ${r}px 0 0`,
        }}
      />
      <div
        className="absolute"
        style={{
          left,
          top: "50%",
          bottom: 0,
          width,
          cursor: "grab",
          userSelect: "none",
        }}
        onMouseDown={(e) => startLoopBodyDrag(e, loopIn, loopOut, zoom, onSetLoopIn, onSetLoopOut, onSetLoopEnabled)}
        onContextMenu={onContextMenu}
      />
    </>
  );
}

/**
 * Standalone in/out marker for the ruler. Shown when only one side of
 * the loop is set (or the two don't form a valid range), so users get
 * immediate feedback after pressing I or O even before the partner key.
 */
function LoopFlag({
  t,
  kind,
  zoom,
  enabled,
}: {
  t: number;
  kind: "in" | "out";
  zoom: number;
  enabled: boolean;
}) {
  const x = t * zoom;
  const opacity = enabled ? 0.9 : 0.45;
  /* Flag lives in the loop zone (bottom half of the ruler) so the
     user's mental model — "loops live here, scrub lives above" — stays
     consistent whether or not a band is currently formed. */
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: x,
        top: "50%",
        bottom: 0,
        width: 1,
        background: `rgba(255, 214, 10, ${opacity})`,
        zIndex: 3,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          [kind === "in" ? "left" : "right"]: 0,
          width: 12,
          height: 12,
          background: `rgba(255, 214, 10, ${opacity})`,
          color: "#1a1a1a",
          fontSize: 9,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: kind === "in" ? "0 3px 3px 0" : "3px 0 0 3px",
        }}
      >
        {kind === "in" ? "I" : "O"}
      </div>
    </div>
  );
}

function LoopHandles({ loopIn, loopOut, zoom, onSetLoopIn, onSetLoopOut, onSetLoopEnabled }: LoopProps) {
  const left = loopIn * zoom;
  const width = Math.max(1, (loopOut - loopIn) * zoom);
  const handleW = Math.min(LOOP_HANDLE_W, width / 2);
  return (
    <>
      <div
        className="absolute"
        style={{
          left,
          top: "50%",
          bottom: 0,
          width: handleW,
          cursor: "ew-resize",
          zIndex: 2,
        }}
        onMouseDown={(e) => startLoopEdgeDrag(e, "left", loopIn, loopOut, zoom, onSetLoopIn, onSetLoopOut, onSetLoopEnabled)}
      />
      <div
        className="absolute"
        style={{
          left: left + width - handleW,
          top: "50%",
          bottom: 0,
          width: handleW,
          cursor: "ew-resize",
          zIndex: 2,
        }}
        onMouseDown={(e) => startLoopEdgeDrag(e, "right", loopIn, loopOut, zoom, onSetLoopIn, onSetLoopOut, onSetLoopEnabled)}
      />
    </>
  );
}

function TimelineToolBtn({
  children,
  onClick,
  title,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  const baseColor = active ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.4)";
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        border: "none",
        background: active ? "rgba(255,255,255,0.12)" : "transparent",
        color: baseColor,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.12s, color 0.12s",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.1)";
        el.style.color = "rgba(255,255,255,1)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = active ? "rgba(255,255,255,0.12)" : "transparent";
        el.style.color = baseColor;
      }}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  const config = useTimelineConfig();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const runImport = useCallback(
    (files: FileList | null) => importFiles(files, config),
    [config],
  );

  if (isMobile) {
    return (
      <div
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: "16px 12px",
          cursor: "pointer",
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: "100%",
            padding: "16px 12px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.09)",
            gap: 8,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" fill="currentColor" />
          </svg>
          <span
            style={{
              fontSize: 12,
              fontWeight: 400,
              letterSpacing: 0.2,
              pointerEvents: "none",
            }}
          >
            {config.copy.emptyHeadlineMobile}
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={config.fileInputAccept}
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            void runImport(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center"
      style={{
        position: "absolute",
        top: 80,
        left: 0,
        right: 0,
        bottom: 120,
        minHeight: 200,
        pointerEvents: "none",
      }}
    >
      <div className="text-center">
        <div
          style={{
            fontWeight: 500,
            color: "rgba(255,255,255,0.55)",
            fontSize: 14,
          }}
        >
          {config.copy.emptyHeadline}
        </div>
        <div style={{ fontSize: 11, marginTop: 4, color: "rgba(255,255,255,0.35)" }}>
          {config.copy.emptySubline}
        </div>
      </div>
    </div>
  );
}

const SECTIONS = [
  {
    title: "Playback",
    rows: [
      ["Space", "Play / Pause"],
      ["Home", "Go to start"],
      ["End", "Go to end"],
      ["Left / Right", "Seek 1 frame"],
      ["Shift + Left / Right", "Seek 1 second"],
      ["Up / Down", "Select previous/next track"],
    ],
  },
  {
    title: "Editing",
    rows: [
      ["K", "Split clip at playhead"],
      ["Alt + K", "Split all clips at loop boundaries"],
      ["Delete / Backspace", "Delete selected clip"],
      ["Shift + Delete", "Delete selected track"],
      ["Shift + D", "Duplicate track"],
      ["Ctrl + C", "Copy clip"],
      ["Ctrl + X", "Cut clip"],
      ["Ctrl + V", "Paste clip at playhead"],
      ["Ctrl + D", "Duplicate clip"],
      ["Ctrl + Z", "Undo"],
      ["Ctrl + Y", "Redo"],
    ],
  },
  {
    title: "Loop region",
    rows: [
      ["I", "Set loop in at playhead"],
      ["O", "Set loop out at playhead"],
      ["L", "Toggle loop playback"],
      ["Alt + I", "Clear loop in point"],
      ["Alt + O", "Clear loop out point"],
      ["Escape", "Clear loop region"],
    ],
  },
  {
    title: "View",
    rows: [
      ["S", "Toggle snap to grid"],
      ["Ctrl + =", "Zoom in"],
      ["Ctrl + -", "Zoom out"],
      ["Ctrl + 0", "Fit timeline to screen"],
    ],
  },
];

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 1000, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="ae-glass-panel"
        style={{
          width: 540,
          maxHeight: "80vh",
          overflowY: "auto",
          borderRadius: 16,
          border: "1px solid var(--color-ae-border)",
          padding: "28px 32px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: "rgba(255,255,255,0.95)", margin: 0 }}>
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: 8,
              color: "rgba(255,255,255,0.6)",
              width: 28,
              height: 28,
              cursor: "pointer",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.35)",
                  marginBottom: 10,
                }}
              >
                {section.title}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {section.rows.map(([key, desc]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between"
                    style={{ padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{desc}</span>
                    <div className="flex items-center" style={{ gap: 4 }}>
                      {key.split(" + ").map((k, i, arr) => (
                        <span key={k} className="flex items-center" style={{ gap: 4 }}>
                          <kbd
                            style={{
                              fontSize: 11,
                              fontFamily: "monospace",
                              background: "rgba(255,255,255,0.08)",
                              border: "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 5,
                              padding: "2px 7px",
                              color: "rgba(255,255,255,0.85)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {k.trim()}
                          </kbd>
                          {i < arr.length - 1 && (
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 24, textAlign: "center" }}>
          Press Escape or click outside to close
        </p>
      </div>
    </div>
  );
}

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

function formatDb(db: number): string {
  if (db === 0) return "0.0";
  const sign = db > 0 ? "+" : "";
  return `${sign}${db.toFixed(1)}`;
}
