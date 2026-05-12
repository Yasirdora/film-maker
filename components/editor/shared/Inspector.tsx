"use client";

/**
 * Inspector — right-docked properties panel for the selected clip.
 *
 * Mode-agnostic: branches on `clip.kind` to surface only the controls that
 * apply to that clip. Audio clips show volume + fades; visual clips
 * (video/image) add transform + opacity + speed; text clips add font/color.
 *
 * Renders nothing until the user selects a clip — `<aside>` collapses to
 * width 0 — so it never steals horizontal space from the timeline /
 * preview when there's no work to do.
 */

import { useEditor } from "@/lib/editor/store";
import type { Clip, TextClip } from "@/lib/editor/types";

const PANEL_W = 280;

export default function Inspector() {
  const selectedClipId = useEditor((s) => s.selectedClipId);
  const clip = useEditor((s) => (selectedClipId ? s.clips[selectedClipId] : null));
  const updateClip = useEditor((s) => s.updateClip);
  const updateClipTransform = useEditor((s) => s.updateClipTransform);

  if (!clip) return null;

  const hasAudioControls = clip.kind === "video" || clip.kind === "audio";
  const hasVisualControls = clip.kind !== "audio";
  const isTextClip = clip.kind === "text";

  return (
    <aside
      style={{
        width: PANEL_W,
        flexShrink: 0,
        background: "var(--color-ae-lane, #101212)",
        borderLeft: "1px solid var(--color-ae-border, rgba(255,255,255,0.06))",
        overflowY: "auto",
        color: "rgba(255,255,255,0.85)",
      }}
      className="scrollbar-dark"
      aria-label="Clip properties"
    >
      <header
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>
          {clip.kind} clip
        </h2>
        <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
          {clip.duration.toFixed(2)}s @ {clip.start.toFixed(2)}s
        </div>
      </header>

      {hasAudioControls && (
        <Section title="Audio">
          <Slider
            label="Volume"
            min={0} max={2} step={0.01} unit="x"
            value={clip.volume}
            onChange={(v) => updateClip(clip.id, { volume: v } as Partial<Clip>)}
          />
          <Slider
            label="Fade in"
            min={0} max={5} step={0.05} unit="s"
            value={clip.fadeIn}
            onChange={(v) => updateClip(clip.id, { fadeIn: v } as Partial<Clip>)}
          />
          <Slider
            label="Fade out"
            min={0} max={5} step={0.05} unit="s"
            value={clip.fadeOut}
            onChange={(v) => updateClip(clip.id, { fadeOut: v } as Partial<Clip>)}
          />
        </Section>
      )}

      {hasVisualControls && !isTextClip && (
        <Section title="Speed">
          <Slider
            label="Playback speed"
            min={0.25} max={4} step={0.05} unit="x"
            value={clip.speed}
            onChange={(v) => updateClip(clip.id, { speed: v } as Partial<Clip>)}
          />
        </Section>
      )}

      {hasVisualControls && (
        <Section title="Transform">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <NumberInput
              label="X"
              value={Math.round(clip.transform.x)}
              onChange={(v) => updateClipTransform(clip.id, { x: v })}
            />
            <NumberInput
              label="Y"
              value={Math.round(clip.transform.y)}
              onChange={(v) => updateClipTransform(clip.id, { y: v })}
            />
          </div>
          <Slider
            label="Scale"
            min={0.05} max={4} step={0.01} unit="x"
            value={clip.transform.scale}
            onChange={(v) => updateClipTransform(clip.id, { scale: v })}
          />
          <Slider
            label="Rotation"
            min={-180} max={180} step={1} unit="°"
            value={clip.transform.rotation}
            onChange={(v) => updateClipTransform(clip.id, { rotation: v })}
          />
          <Slider
            label="Opacity"
            min={0} max={1} step={0.01} unit=""
            value={clip.transform.opacity}
            onChange={(v) => updateClipTransform(clip.id, { opacity: v })}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <Toggle
              label="Flip H"
              value={clip.transform.flipX}
              onChange={(v) => updateClipTransform(clip.id, { flipX: v })}
            />
            <Toggle
              label="Flip V"
              value={clip.transform.flipY}
              onChange={(v) => updateClipTransform(clip.id, { flipY: v })}
            />
          </div>
        </Section>
      )}

      {isTextClip && (
        <TextSection
          clip={clip}
          updateClip={(patch) => updateClip(clip.id, patch)}
        />
      )}
    </aside>
  );
}

/* ── Atoms ───────────────────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <h3
        style={{
          margin: "0 0 8px",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        {title}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  unit,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  unit: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <span style={{ color: "rgba(255,255,255,0.55)" }}>{label}</span>
        <span style={{ color: "rgba(255,255,255,0.85)", fontVariantNumeric: "tabular-nums" }}>
          {value.toFixed(step < 1 ? 2 : 0)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="ae-volume-slider"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{
          height: 28,
          padding: "0 8px",
          fontSize: 12,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 6,
          color: "#fff",
          outline: "none",
        }}
      />
    </label>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        flex: 1,
        height: 28,
        fontSize: 11,
        borderRadius: 6,
        border: value
          ? "1px solid rgba(255,255,255,0.45)"
          : "1px solid rgba(255,255,255,0.08)",
        background: value ? "rgba(255,255,255,0.10)" : "transparent",
        color: value ? "#fff" : "rgba(255,255,255,0.7)",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function TextSection({
  clip,
  updateClip,
}: {
  clip: TextClip;
  updateClip: (patch: Partial<TextClip>) => void;
}) {
  const s = clip.style;
  return (
    <Section title="Text">
      <textarea
        value={s.text}
        onChange={(e) => updateClip({ style: { ...s, text: e.target.value } })}
        style={{
          minHeight: 60,
          padding: 8,
          fontSize: 13,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 6,
          color: "#fff",
          resize: "vertical",
          outline: "none",
          fontFamily: "inherit",
        }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <NumberInput
          label="Font size"
          value={s.fontSize}
          onChange={(v) => updateClip({ style: { ...s, fontSize: v } })}
        />
        <NumberInput
          label="Weight"
          value={s.fontWeight}
          onChange={(v) => updateClip({ style: { ...s, fontWeight: v } })}
        />
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Color</span>
        <input
          type="color"
          value={s.color}
          onChange={(e) => updateClip({ style: { ...s, color: e.target.value } })}
          style={{
            height: 32,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
          }}
        />
      </label>
      <div style={{ display: "flex", gap: 4 }}>
        {(["left", "center", "right"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => updateClip({ style: { ...s, align: a } })}
            style={{
              flex: 1,
              height: 28,
              fontSize: 11,
              textTransform: "capitalize",
              borderRadius: 6,
              border: s.align === a
                ? "1px solid rgba(255,255,255,0.45)"
                : "1px solid rgba(255,255,255,0.08)",
              background: s.align === a ? "rgba(255,255,255,0.10)" : "transparent",
              color: s.align === a ? "#fff" : "rgba(255,255,255,0.7)",
              cursor: "pointer",
            }}
          >
            {a}
          </button>
        ))}
      </div>
    </Section>
  );
}
