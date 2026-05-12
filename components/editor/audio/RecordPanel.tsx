"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  addMeterListener,
  isRecordingSupported,
  onRecorderChange,
  recorderElapsed,
  recorderState,
} from "@/lib/editor/recorder";
import { useEditor } from "@/lib/editor/store";

/**
 * Recording status panel — pure indicator surface that mounts whenever the
 * recorder is non-idle or there's an error to show. Transport controls
 * (start/stop/pause/resume) live in the floating dock; the only affordance
 * unique to this panel is the discard ✕, since "abandon take" is a distinct
 * action from "stop and import".
 */
export default function RecordPanel() {
  const recorderError = useEditor((s) => s.recorderError);
  const setRecorderError = useEditor((s) => s.setRecorderError);
  const recorderCancel = useEditor((s) => s.recorderCancel);

  const state = useSyncExternalStore(onRecorderChange, recorderState, () => "idle" as const);
  const supported = isRecordingSupported();

  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState({ rms: 0, peak: 0 });
  const rafRef = useRef(0);
  const meterCanvasRef = useRef<HTMLCanvasElement | null>(null);

  /* Display-only derivations — keeps render pure and avoids reset-via-effect
     patterns the React 19 hooks rule (correctly) flags. The underlying
     `elapsed`/`level` state can stay stale; the displayed values are gated
     by recorder state and zero out cleanly when the take ends. */
  const displayElapsed = state === "idle" ? 0 : elapsed;
  /* Memoised so the canvas-draw effect's deps array doesn't allocate a fresh
     `{ rms: 0, peak: 0 }` object every render and re-fire forever. */
  const displayLevel = useMemo(
    () => (state === "recording" ? level : { rms: 0, peak: 0 }),
    [state, level],
  );

  // Timer tick — reads from the recorder's own elapsed clock so the displayed
  // time always reflects the source of truth, not a drifted local counter.
  useEffect(() => {
    if (state !== "recording") return;
    const tick = () => {
      setElapsed(recorderElapsed());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state]);

  // Meter listener — reads RMS/peak for the level bar. The live-peaks pipeline
  // taps the same analyser via its own listener; both consumers coexist.
  useEffect(() => {
    if (state !== "recording") return;
    return addMeterListener(({ rms, peak }) => setLevel({ rms, peak }));
  }, [state]);

  // Draw meter on canvas
  useEffect(() => {
    const canvas = meterCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 4);
    ctx.fill();

    const rmsW = Math.min(1, displayLevel.rms * 4) * w;
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, "rgba(50, 215, 75, 0.8)");
    gradient.addColorStop(0.6, "rgba(255, 214, 10, 0.8)");
    gradient.addColorStop(0.85, "rgba(255, 69, 58, 0.8)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(0, 0, rmsW, h, 4);
    ctx.fill();

    const peakX = Math.min(1, displayLevel.peak * 3) * w;
    if (peakX > 2) {
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(peakX - 1, 0, 2, h);
    }
  }, [displayLevel]);

  const showError = !!recorderError || !supported;
  if (state === "idle" && !showError) return null;

  const errorMessage = !supported
    ? "Recording is not supported in this browser."
    : recorderError;

  return (
    <div
      style={{
        width: "100%",
        padding: "12px 20px",
        background: "rgba(255, 59, 48, 0.03)",
        borderBottom: "1px solid rgba(255, 59, 48, 0.12)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        animation: "recordPanelIn 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
      }}
    >
      <style>{`
        @keyframes recordPanelIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex items-center justify-between" style={{ gap: 16 }}>
        <div className="flex items-center" style={{ gap: 10 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background:
                state === "recording" ? "#ff3b30" : state === "paused" ? "#ff9500" : "rgba(255,255,255,0.2)",
              boxShadow: state === "recording" ? "0 0 12px rgba(255,59,48,0.5)" : "none",
              animation: state === "recording" ? "recordPulse 1.2s ease-in-out infinite" : "none",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color:
                state === "recording" ? "#ff6961" : state === "paused" ? "#ff9500" : "rgba(255,255,255,0.7)",
              letterSpacing: "-0.01em",
            }}
          >
            {state === "recording" ? "Recording" : state === "paused" ? "Paused" : "Ready"}
          </span>
          {state !== "idle" && (
            <span
              style={{
                fontFamily: "'SF Mono', 'ui-monospace', monospace",
                fontSize: 14,
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
                marginLeft: 6,
                letterSpacing: "1px",
              }}
            >
              {formatElapsed(displayElapsed)}
            </span>
          )}
        </div>

        {state !== "idle" && (
          <button
            type="button"
            onClick={recorderCancel}
            aria-label="Discard recording"
            title="Discard recording"
            className="flex items-center justify-center transition-all ae-ease"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "transparent",
              color: "rgba(255,255,255,0.55)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {state !== "idle" && (
        <canvas
          ref={meterCanvasRef}
          style={{ width: "100%", height: 6, borderRadius: 4 }}
        />
      )}

      {errorMessage && (
        <div
          role="alert"
          style={{
            fontSize: 12,
            color: "#ff6961",
            padding: "6px 10px",
            background: "rgba(255,59,48,0.08)",
            borderRadius: 6,
            border: "1px solid rgba(255,59,48,0.15)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{errorMessage}</span>
          {recorderError && (
            <button
              type="button"
              onClick={() => setRecorderError(null)}
              aria-label="Dismiss error"
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,105,97,0.7)",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                padding: 2,
              }}
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatElapsed(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
}
