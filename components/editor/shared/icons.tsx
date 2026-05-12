/**
 * SVG icon set, hand-drawn to mimic Material Symbols Rounded at weight 200.
 *
 * Why not the real Material Symbols font:
 *   Google Fonts' icon font is fetched cross-origin and requires CORS-permissive
 *   server headers to load in this app. Self-hosted SVGs avoid the dependency
 *   and work offline, which matters for a browser-local video editor.
 *
 * Style: stroke 1.6, rounded line caps + joins, viewBox 24×24, currentColor
 * fills/strokes so callers control color via CSS. Filled variants exist for
 * play/pause/record etc.
 *
 * Optimization: Multi-path icons are wrapped in a <g> to ensure that any 
 * opacity applied to the icon (via CSS or props) is applied to the flattened 
 * group, preventing overlapping path artifacts.
 */
import type { CSSProperties, SVGProps } from "react";

const baseLine = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const baseFill = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "currentColor",
};

type Props = SVGProps<SVGSVGElement>;

/* ── Brand ─────────────────────────────────────────────────────────── */

export function GraphicEq(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <g>
        <line x1="4" y1="12" x2="4" y2="16" />
        <line x1="8" y1="8" x2="8" y2="20" />
        <line x1="12" y1="4" x2="12" y2="22" />
        <line x1="16" y1="9" x2="16" y2="17" />
        <line x1="20" y1="13" x2="20" y2="15" />
      </g>
    </svg>
  );
}

export function ArrowLeft(p: Props) {
  return (
    <svg width="6" height="11" viewBox="0 0 6 11" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      <path d="M5.44975 0.49996L0.5 5.44971L5.44975 10.3995" />
    </svg>
  );
}

/* ── Tools (sidebar) ───────────────────────────────────────────────── */

export function ArrowSelectorTool(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <path d="M 6 6 L 10 20 L 13.5 13.5 L 20 10 Z" strokeLinejoin="round" />
    </svg>
  );
}

export function ContentCut(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <g>
        <path d="M7 4H3v16h4" />
        <path d="M17 4h4v16h-4" />
        <line x1="12" y1="2" x2="12" y2="22" />
      </g>
    </svg>
  );
}

export function PanTool(p: Props) {
  return (
    <svg {...baseLine} viewBox="-3 0 24 24" {...p} aria-hidden="true">
      <path d="M18.0845 4.13303V15.677C18.0845 19.5701 15.1755 22.8491 11.3102 23.313C7.91744 23.7201 4.66293 21.8399 3.32098 18.6973L0.500244 12.0917M4.54199 12.6284V3.12385M9.19092 10.5917V0.5M13.8399 10.5917V2.11468" />
    </svg>
  );
}

export function RangeTool(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Folder(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function Settings(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <g>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </g>
    </svg>
  );
}

/* ── Track type glyphs ─────────────────────────────────────────────── */

export function Mic(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <g>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <line x1="12" y1="18" x2="12" y2="22" />
      </g>
    </svg>
  );
}

export function Piano(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <g>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v10M15 4v10" />
        <path d="M3 14h18" />
      </g>
    </svg>
  );
}

export function Album(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <g>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" />
        <line x1="15" y1="9" x2="19" y2="5" />
      </g>
    </svg>
  );
}

export function MusicNote(p: Props) {
  return (
    <svg {...baseFill} {...p} aria-hidden="true">
      <path d="M9 18V5l12-2v13a4 4 0 1 1-2-3.46V6.7l-8 1.4V19a4 4 0 1 1-2-3.46z" />
    </svg>
  );
}

export function LibraryMusic(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <g>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </g>
    </svg>
  );
}

/* ── Header chrome ─────────────────────────────────────────────────── */

export function Undo(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <path d="M4 10 L9 5 M4 10 L9 15 M4 10 H14 A 6 6 0 0 1 14 22 H10" />
    </svg>
  );
}

export function Redo(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <path d="M20 10 L15 5 M20 10 L15 15 M20 10 H10 A 6 6 0 0 0 10 22 H14" />
    </svg>
  );
}

export function IosShare(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <g>
        <path d="M12 3v13" />
        <polyline points="8 7 12 3 16 7" />
        <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
      </g>
    </svg>
  );
}

/* ── Transport ─────────────────────────────────────────────────────── */

export function PlayArrow(p: Props) {
  return (
    <svg {...baseFill} {...p} aria-hidden="true">
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}
export function Pause(p: Props) {
  return (
    <svg {...baseFill} {...p} aria-hidden="true">
      <g>
        <rect x="6" y="5" width="4" height="14" rx="1" />
        <rect x="14" y="5" width="4" height="14" rx="1" />
      </g>
    </svg>
  );
}
export function SkipPrevious(p: Props) {
  return (
    <svg {...baseFill} {...p} aria-hidden="true">
      <g>
        <rect x="5" y="5" width="2" height="14" rx="1" />
        <path d="M19 6L9 12l10 6V6z" />
      </g>
    </svg>
  );
}
export function SkipNextIcon(p: Props) {
  return (
    <svg {...baseFill} {...p} aria-hidden="true">
      <g>
        <rect x="17" y="5" width="2" height="14" rx="1" />
        <path d="M5 6l10 6L5 18V6z" />
      </g>
    </svg>
  );
}
export function FiberManualRecord(p: Props) {
  return (
    <svg {...baseFill} {...p} aria-hidden="true">
      <circle cx="12" cy="12" r="6" />
    </svg>
  );
}

export function VolumeUp(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <g>
        <path d="M11 5L6 9H3v6h3l5 4V5z" />
        <path d="M15.5 8.5a4.5 4.5 0 0 1 0 7" />
        <path d="M18 6a8 8 0 0 1 0 12" />
      </g>
    </svg>
  );
}

/* ── Lock toggle ───────────────────────────────────────────────────── */

export function LockClosed(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <g>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </g>
    </svg>
  );
}

export function LockOpen(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <g>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 7.5-2" />
      </g>
    </svg>
  );
}

/* ── Track header chrome ────────────────────────────────────────────── */

export function MoreVert(p: Props) {
  return (
    <svg {...baseFill} {...p} aria-hidden="true">
      <g>
        <circle cx="12" cy="5.5" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="12" cy="18.5" r="1.6" />
      </g>
    </svg>
  );
}

export function ChevronRight(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

export function CheckMark(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <polyline points="5 12 10 17 19 7" />
    </svg>
  );
}

export function Loop(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <g>
        <path d="m17 2 4 4-4 4" />
        <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
        <path d="m7 22-4-4 4-4" />
        <path d="M21 13v1a4 4 0 0 1-4 4H3" />
      </g>
    </svg>
  );
}

export function Magnet(p: Props & { active?: boolean }) {
  const { active, ...rest } = p;
  return (
    <svg
      {...baseLine}
      {...rest}
      aria-hidden="true"
      style={{
        ...(rest.style as CSSProperties | undefined),
        filter: active ? "none" : "grayscale(1) brightness(0.7)",
        opacity: active ? 1 : 0.4,
        transition: "all 0.2s ae-ease",
      }}
    >
      <g>
        <path d="M5 10v4a7 7 0 0 0 14 0v-4" />
        <path d="M5 4v6h4V4zM15 4v6h4V4z" />
        <path d="M5 7h4M15 7h4" opacity="0.3" />
      </g>
    </svg>
  );
}

export function ShowlinesIcon(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M2 12h4l4-8 4 16 4-8h4" />
    </svg>
  );
}

export function ContentCopy(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <g>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </g>
    </svg>
  );
}

export function PasteIcon(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <g>
        <path d="M9 2h6a1 1 0 0 1 1 1v1H8V3a1 1 0 0 1 1-1z" />
        <rect x="4" y="4" width="16" height="18" rx="2" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </g>
    </svg>
  );
}

export function DuplicateIcon(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <g>
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <rect x="4" y="4" width="11" height="11" rx="2" />
      </g>
    </svg>
  );
}export function SplitAtLoop(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <g>
        <path d="M2 4h2c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H2" />
        <rect x="9" y="4" width="6" height="16" rx="2" />
        <path d="M22 20h-2c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h2" />
      </g>
    </svg>
  );
}

export function SplitAtPlayhead(p: Props) {
  return (
    <svg {...baseLine} {...p} aria-hidden="true">
      <g>
        <path d="M5 4h3c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H5" />
        <path d="M19 20h-3c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h3" />
      </g>
    </svg>
  );
}
