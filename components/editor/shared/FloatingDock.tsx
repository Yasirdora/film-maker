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

import type { ReactNode } from "react";
import { useEditor } from "@/lib/editor/store";
import { useClockTime, useClockPlaying } from "@/lib/editor/clock";
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

  const dockStyle: React.CSSProperties = isMobile
    ? {
        /* In flow at the bottom of the timeline column; sits flush above
           MobileEditingBar. Single row, no SMPTE — the ruler carries time.
           Keeps the dark dock wrapper but skips backdrop-filter blur. */
        position: "relative",
        flexShrink: 0,
        height: 52,
        padding: "0 12px",
        gap: 6,
        justifyContent: "center",
        background: "rgba(18, 18, 18, 0.94)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        zIndex: 50,
      }
    : {
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "6px 8px",
        gap: 10,
        borderRadius: 14,
        zIndex: 100,
        background: "rgba(18, 18, 18, 0.94)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 32px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.02)",
      };

  return (
    <div className="flex items-center" style={dockStyle}>
      <div className="flex items-center" style={{ gap: 4 }}>
        <TBtn
          title={transportDisabled ? "Add media to enable" : "Go to start"}
          onClick={() => seek(0)}
          disabled={isRecorderActive || transportDisabled}
        >
          <SkipPrevious width={18} height={18} />
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
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            border: "none",
            background: "#fdfdfd",
            color: "#000000",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.8)",
            flexShrink: 0,
            margin: "0 4px",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#ffffff";
            (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#fdfdfd";
            (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          }}
        >
          {showPauseIcon ? (
            <Pause width={22} height={22} />
          ) : (
            <PlayArrow width={22} height={22} style={{ marginLeft: 2 }} />
          )}
        </button>

        <TBtn
          title={transportDisabled ? "Add media to enable" : "Go to end"}
          onClick={() => seek(total)}
          disabled={isRecorderActive || transportDisabled}
        >
          <SkipNextIcon width={18} height={18} />
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

      <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.08)", margin: "0 4px" }} />

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
  return (
    <div
      style={{
        width: 1,
        height: 16,
        background: "rgba(255,255,255,0.12)",
        margin: "0 4px",
      }}
    />
  );
}

function CompactTime() {
  const t = useClockTime();
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return (
    <div
      style={{
        fontFamily: "'SF Mono', 'ui-monospace', monospace",
        fontSize: 13,
        fontWeight: 600,
        color: "rgba(255,255,255,0.85)",
        letterSpacing: "0.5px",
        userSelect: "none",
      }}
    >
      {`${m}:${String(s).padStart(2, "0")}`}
    </div>
  );
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
        width: 38,
        height: 38,
        borderRadius: 8,
        border: "none",
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
      <Loop width={20} height={20} />
    </TBtn>
  );
}

function Timecode() {
  const t = useClockTime();
  const fps = useEditor((s) => s.canvas.fps);
  return (
    <div
      style={{
        fontFamily: "'SF Mono', 'ui-monospace', monospace",
        fontSize: 15,
        fontWeight: 600,
        color: "#fff",
        background: "#000000",
        padding: "10px 20px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.08)",
        letterSpacing: "1.5px",
        minWidth: 130,
        textAlign: "center",
        userSelect: "none",
      }}
    >
      {formatSMPTE(t, fps)}
    </div>
  );
}

function formatSMPTE(t: number, fps: number): string {
  const totalSecs = Math.max(0, t);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.floor(totalSecs % 60);
  const f = Math.floor((totalSecs - Math.floor(totalSecs)) * fps);
  return [h, m, s, f].map((n) => String(n).padStart(2, "0")).join(":");
}
