"use client";

/**
 * FloatingDock — transport surface (skip-to-start, play, skip-to-end, optional
 * record, loop) plus a timecode readout. Mode-agnostic: the audio editor wires
 * in a recorder integration and an `ensureRunning` pre-play hook; editors
 * without a recorder simply omit those props and the record button vanishes.
 *
 * Layout:
 *   • Mobile: in-flow row at the bottom of the timeline column, no SMPTE.
 *   • Desktop: floating squircle pinned to bottom-center, with SMPTE timecode.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { useEditor } from "@/lib/editor/store";
import { clock, useClockPlaying } from "@/lib/editor/clock";
import { useIsMobile } from "@/lib/editor/useMediaQuery";
import {
  Loop,
  Pause,
  PlayArrow,
  SkipNextIcon,
  SkipPrevious,
} from "./icons";

export type RecorderState = "idle" | "recording" | "paused";

export type RecorderIntegration = {
  /** Live recorder state — wire this to a subscription on the recorder. */
  state: RecorderState;
  /** idle → start, recording → pause, paused → stop & import. */
  toggle: () => void | Promise<void>;
};

/* ─── Style + size constants ─────────────────────────────────────────
 * Hoisted out of the render path so we don't re-allocate the same style
 * objects on every dock re-render (the dock re-renders whenever the
 * editor store fires — record state, totalDuration, etc.). Values
 * tuned ~15 % tighter than the prior dock for a denser, more
 * professional readout while keeping the buttons comfortably tappable.
 */
const PLAY_BTN_SIZE = 40;
const TBTN_SIZE = 34;

const MOBILE_DOCK_STYLE: React.CSSProperties = {
  /* In flow at the bottom of the timeline column; sits flush above
     MobileEditingBar. Single row, no SMPTE — the ruler carries time.
     Keeps the dark dock wrapper but skips backdrop-filter blur. */
  position: "relative",
  flexShrink: 0,
  height: 48,
  padding: "0 12px",
  gap: 6,
  justifyContent: "center",
  background: "rgba(18, 18, 18, 0.94)",
  borderTop: "1px solid rgba(255,255,255,0.08)",
  zIndex: 50,
};

const DESKTOP_DOCK_STYLE: React.CSSProperties = {
  position: "fixed",
  bottom: 20,
  left: "50%",
  transform: "translateX(-50%)",
  padding: "5px 7px",
  gap: 8,
  borderRadius: 12,
  zIndex: 100,
  background: "rgba(18, 18, 18, 0.94)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 28px 56px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.02)",
};

const PLAY_BTN_STYLE: React.CSSProperties = {
  width: PLAY_BTN_SIZE,
  height: PLAY_BTN_SIZE,
  borderRadius: 9,
  border: "none",
  background: "#fdfdfd",
  color: "#000000",
  cursor: "pointer",
  boxShadow: "0 4px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.8)",
  flexShrink: 0,
  margin: "0 3px",
};

const PLAY_BTN_DISABLED_STYLE: React.CSSProperties = {
  ...PLAY_BTN_STYLE,
  cursor: "not-allowed",
};

const DOCK_MAIN_DIVIDER_STYLE: React.CSSProperties = {
  width: 1,
  height: 24,
  background: "rgba(255,255,255,0.08)",
  margin: "0 3px",
};

const DOCK_INNER_DIVIDER_STYLE: React.CSSProperties = {
  width: 1,
  height: 14,
  background: "rgba(255,255,255,0.12)",
  margin: "0 3px",
};

const TBTN_BASE_STYLE: React.CSSProperties = {
  width: TBTN_SIZE,
  height: TBTN_SIZE,
  borderRadius: 7,
  border: "none",
};

const TIMECODE_STYLE: React.CSSProperties = {
  fontFamily: "'SF Mono', 'ui-monospace', monospace",
  fontSize: 13,
  fontWeight: 600,
  color: "#fff",
  background: "#000000",
  padding: "7px 14px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.08)",
  letterSpacing: "1.2px",
  minWidth: 112,
  textAlign: "center" as const,
  userSelect: "none" as const,
};

const COMPACT_TIME_STYLE: React.CSSProperties = {
  fontFamily: "'SF Mono', 'ui-monospace', monospace",
  fontSize: 12,
  fontWeight: 600,
  color: "rgba(255,255,255,0.85)",
  letterSpacing: "0.5px",
  userSelect: "none" as const,
};

export type FloatingDockProps = {
  /** Called once before each transport play action. Audio passes
   *  `ensureRunning` to unlock the AudioContext on first user gesture; video
   *  can omit. */
  beforePlay?: () => void | Promise<void>;
  /** When provided, renders a record button and treats recorder state as
   *  part of the play/pause affordance (recording is also "playing"). */
  recorder?: RecorderIntegration;
};

export default function FloatingDock({ beforePlay, recorder }: FloatingDockProps = {}) {
  const playing = useClockPlaying();
  const total = useEditor((s) => s.totalDuration());
  const transportToggle = useEditor((s) => s.transportToggle);
  const seek = useEditor((s) => s.seek);
  const hasMedia = useEditor((s) => s.clipOrder.length > 0);
  const isMobile = useIsMobile();

  const isRecording = recorder?.state === "recording";
  const isPaused = recorder?.state === "paused";
  const isRecorderActive = isRecording || isPaused;

  // Transport requires media on the timeline. The record button stays enabled
  // so a user with no uploads can still create their first take.
  const transportDisabled = !hasMedia && !isRecorderActive;

  // Play button shows "pause" affordance when either playback or recording is active.
  const showPauseIcon = isRecording || (!isRecorderActive && playing);

  const dockStyle: React.CSSProperties = isMobile ? MOBILE_DOCK_STYLE : DESKTOP_DOCK_STYLE;

  return (
    <div className="flex items-center" style={dockStyle}>
      <div className="flex items-center" style={{ gap: 4 }}>
        <TBtn
          title={transportDisabled ? "Add media to enable" : "Go to start"}
          onClick={() => seek(0)}
          disabled={isRecorderActive || transportDisabled}
        >
          <SkipPrevious width={16} height={16} />
        </TBtn>

        <button
          type="button"
          onClick={() => {
            if (transportDisabled) return;
            void beforePlay?.();
            transportToggle();
          }}
          disabled={transportDisabled}
          aria-label={
            isRecording
              ? "Pause recording"
              : isPaused
              ? "Resume recording"
              : showPauseIcon
              ? "Pause"
              : "Play"
          }
          className="flex items-center justify-center transition-all ae-ease group"
          style={transportDisabled ? PLAY_BTN_DISABLED_STYLE : PLAY_BTN_STYLE}
          onMouseEnter={(e) => {
            if (transportDisabled) return;
            (e.currentTarget as HTMLElement).style.background = "#ffffff";
            (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            if (transportDisabled) return;
            (e.currentTarget as HTMLElement).style.background = "#fdfdfd";
            (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          }}
        >
          {showPauseIcon ? (
            <Pause width={20} height={20} />
          ) : (
            <PlayArrow width={20} height={20} style={{ marginLeft: 2 }} />
          )}
        </button>

        <TBtn
          title={transportDisabled ? "Add media to enable" : "Go to end"}
          onClick={() => seek(total)}
          disabled={isRecorderActive || transportDisabled}
        >
          <SkipNextIcon width={16} height={16} />
        </TBtn>

        {recorder && (
          <>
            <DockDivider />
            <RecordButton
              state={recorder.state}
              onToggle={recorder.toggle}
              active={isRecorderActive}
            />
          </>
        )}

        <LoopBtn disabled={transportDisabled} />
      </div>

      <div style={DOCK_MAIN_DIVIDER_STYLE} />

      {isMobile ? <CompactTime /> : <Timecode />}
    </div>
  );
}

/* ── Subcomponents ───────────────────────────────────────────────────── */

function RecordButton({
  state,
  onToggle,
  active,
}: {
  state: RecorderState;
  onToggle: () => void | Promise<void>;
  active: boolean;
}) {
  const recording = state === "recording";
  const paused = state === "paused";
  const title = recording
    ? "Stop recording"
    : paused
    ? "Stop and import"
    : "Start recording";
  const dotColor = recording ? "#ff3b30" : paused ? "#ff9500" : "#ff3b30";
  const dotShadow = recording
    ? "0 0 10px rgba(255,59,48,0.6)"
    : paused
    ? "0 0 6px rgba(255,149,0,0.5)"
    : "0 0 10px rgba(255,59,48,0.4)";
  return (
    <TBtn
      title={title}
      onClick={() => { void onToggle(); }}
      active={active}
      color={recording ? "#ff3b30" : paused ? "#ff9500" : "white"}
      opacity={active ? 1 : 0.55}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: active ? 2 : 3,
          background: dotColor,
          boxShadow: dotShadow,
          animation: recording ? "recordPulse 1.2s ease-in-out infinite" : "none",
        }}
      />
    </TBtn>
  );
}

function DockDivider() {
  return <div style={DOCK_INNER_DIVIDER_STYLE} />;
}

/**
 * Compact mobile readout (m:ss). Updates imperatively on each clock
 * tick — writing to `textContent` directly so playback doesn't trip a
 * React re-render of the whole dock subtree 60×/second. Cheaper than
 * `useClockTime()` and visually identical.
 */
function CompactTime() {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastText = useRef("");
  useEffect(() => {
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const t = clock.time();
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      const next = `${m}:${String(s).padStart(2, "0")}`;
      /* Compare before writing — `textContent` writes still invalidate
         layout even when the string is unchanged, and the clock fires
         at frame rate while the seconds digit only ticks once a second. */
      if (lastText.current !== next) {
        lastText.current = next;
        el.textContent = next;
      }
    };
    apply();
    return clock.subscribe(apply);
  }, []);
  return <div ref={ref} style={COMPACT_TIME_STYLE} />;
}

function TBtn({
  children,
  onClick,
  title,
  color = "white",
  opacity = 0.55,
  active = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  color?: string;
  opacity?: number;
  active?: boolean;
  disabled?: boolean;
}) {
  const baseOpacity = active ? 1 : opacity;
  const resolvedColor = disabled
    ? "rgba(255,255,255,0.2)"
    : active
    ? color === "white"
      ? "#fff"
      : color
    : color;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="flex items-center justify-center transition-all ae-ease"
      style={{
        ...TBTN_BASE_STYLE,
        background: active ? "rgba(255,255,255,0.1)" : "transparent",
        color: resolvedColor,
        opacity: disabled ? 1 : baseOpacity,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
        (e.currentTarget as HTMLElement).style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLElement).style.background = active
          ? "rgba(255,255,255,0.1)"
          : "transparent";
        (e.currentTarget as HTMLElement).style.opacity = active ? "1" : String(opacity);
      }}
    >
      {children}
    </button>
  );
}

function LoopBtn({ disabled = false }: { disabled?: boolean }) {
  const loopEnabled = useEditor((s) => s.loopEnabled);
  const setLoopEnabled = useEditor((s) => s.setLoopEnabled);
  return (
    <TBtn
      title={disabled ? "Add media to enable" : "Loop (L)"}
      onClick={() => setLoopEnabled(!loopEnabled)}
      disabled={disabled}
      color={loopEnabled ? "#ffd60a" : "white"}
      opacity={loopEnabled ? 1 : 0.55}
      active={loopEnabled}
    >
      <Loop width={18} height={18} />
    </TBtn>
  );
}

/**
 * SMPTE readout (hh:mm:ss:ff). Subscribes directly to the clock and
 * writes `textContent` imperatively — the parent dock never re-renders
 * just because the playhead moved, which keeps idle dock cost flat
 * during playback regardless of how many tracks are on the timeline.
 * `fps` lives in the editor store and changes rarely, so we re-read it
 * inside the subscriber instead of holding it as a render-tracked dep.
 */
function Timecode() {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastText = useRef("");
  /* Subscribe `fps` through the store so the readout updates instantly
     when the user changes project frame rate (very rare, but visible). */
  const fps = useEditor((s) => s.canvas.fps);
  useEffect(() => {
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const next = formatSMPTE(clock.time(), fps);
      if (lastText.current !== next) {
        lastText.current = next;
        el.textContent = next;
      }
    };
    apply();
    return clock.subscribe(apply);
  }, [fps]);
  return <div ref={ref} style={TIMECODE_STYLE} />;
}

function formatSMPTE(t: number, fps: number): string {
  const totalSecs = Math.max(0, t);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.floor(totalSecs % 60);
  const f = Math.floor((totalSecs - Math.floor(totalSecs)) * fps);
  return [h, m, s, f].map((n) => String(n).padStart(2, "0")).join(":");
}
