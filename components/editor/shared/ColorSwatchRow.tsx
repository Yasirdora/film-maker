"use client";

import { useState } from "react";
import { TRACK_COLORS } from "@/lib/editor/trackColors";

/**
 * A row of color swatches keyed off the shared TRACK_COLORS palette.
 * Used by both the track kebab menu and the clip context menu so that
 * track and clip colors stay visually interchangeable.
 */
export default function ColorSwatchRow({
  value,
  onChange,
  label = "Color",
  ariaLabel = "Color",
}: {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
  ariaLabel?: string;
}) {
  return (
    <div style={{ padding: "8px 10px 10px" }}>
      <p
        style={{
          margin: "0 0 8px",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        {label}
      </p>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${TRACK_COLORS.length}, 22px)`,
          gap: 6,
        }}
      >
        {TRACK_COLORS.map((c) => (
          <ColorSwatch
            key={c}
            color={c}
            selected={c.toLowerCase() === value.toLowerCase()}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
    </div>
  );
}

function ColorSwatch({
  color,
  selected,
  onClick,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  /* Fixed 22×22 carrier so swatches keep their footprint regardless of
     selection state. The selection ring is an inset shadow on the carrier
     (no layout shift); only the inner colored span scales on hover. */
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`Color ${color}`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        border: "none",
        padding: 0,
        margin: 0,
        background: "transparent",
        cursor: "pointer",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: selected ? "inset 0 0 0 2px white" : "none",
        transition: "box-shadow 0.12s",
        outline: "none",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "block",
          width: 14,
          height: 14,
          borderRadius: 4,
          background: color,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
          transform: hovered && !selected ? "scale(1.12)" : "scale(1)",
          transition: "transform 0.12s",
        }}
      />
    </button>
  );
}
