"use client";

/**
 * Inspector — properties panel for the selected clip.
 *
 * Lives as a full-height right column inside the editor's rounded shell,
 * sibling to the preview/timeline splitter. Spanning both rows lets the
 * user resize the preview/timeline ratio without affecting the panel and
 * keeps the panel visible while scrubbing the timeline.
 *
 * Two visible states (controlled by the user, persisted to localStorage):
 *   • Expanded — full panel (PANEL_W wide). Header carries a chevron to
 *     collapse, body lists clip-type-specific controls.
 *   • Collapsed — thin rail (COLLAPSED_W wide) with a chevron to expand
 *     and a vertically-rotated "Properties" label so the panel remains
 *     discoverable, mirroring DaVinci Resolve's Inspector behavior.
 *
 * Returns `null` when no clip is selected so the parent flex row reclaims
 * the freed width and the preview / timeline column grows to fill the
 * shell. The collapsed state is remembered across selections so users
 * who prefer a roomy canvas don't have to re-collapse for every clip.
 *
 * Mode-agnostic content: branches on `clip.kind` to surface only the
 * controls that apply. Audio clips show volume + fades; visual clips
 * (video / image) add transform + opacity + speed; text clips add font
 * / color.
 *
 * Horizontal scroll: explicitly suppressed via `overflowX: hidden` plus
 * `box-sizing: border-box` and `min-width: 0` on every flex/grid child
 * that wraps a form control, so browser-intrinsic input widths can't
 * push past the panel's outer bound.
 */

import { useCallback, useLayoutEffect, useState } from "react";

import { useEditor } from "@/lib/editor/store";
import type { Clip, TextClip } from "@/lib/editor/types";

const PANEL_W = 280;
const COLLAPSED_W = 40;
const COLLAPSE_STORAGE_KEY = "film-maker:editor.inspector.collapsed";

/* ─── Persistence helpers ─────────────────────────────────────────────── */

/**
 * Reads the persisted collapse flag. Best-effort: any storage failure
 * (private mode, quota, server runtime) falls back to expanded.
 */
function loadCollapsed(): boolean {
    if (typeof window === "undefined") return false;
    try {
        return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

/** Persists the collapse flag. Swallows any storage error — non-fatal. */
function persistCollapsed(value: boolean): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, value ? "1" : "0");
    } catch {
        /* quota / private mode — non-fatal */
    }
}

/* ─── Inspector ───────────────────────────────────────────────────────── */

export default function Inspector() {
    const selectedClipId = useEditor((s) => s.selectedClipId);
    const clip = useEditor((s) =>
        selectedClipId ? s.clips[selectedClipId] : null,
    );
    const updateClip = useEditor((s) => s.updateClip);
    const updateClipTransform = useEditor((s) => s.updateClipTransform);

    /* Start collapsed=false on the server so SSR markup is deterministic;
       hydrate the persisted value in a layout effect to avoid a paint
       flash between expanded and collapsed states. The unconditional
       setState pairs with a one-shot mount effect, so the loop the lint
       rule guards against can't happen here. */
    const [collapsed, setCollapsedState] = useState(false);
    useLayoutEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCollapsedState(loadCollapsed());
    }, []);

    const setCollapsed = useCallback((value: boolean) => {
        setCollapsedState(value);
        persistCollapsed(value);
    }, []);

    if (!clip) return null;

    if (collapsed) {
        return (
            <CollapsedRail onExpand={() => setCollapsed(false)} />
        );
    }

    const hasAudioControls = clip.kind === "video" || clip.kind === "audio";
    const hasVisualControls = clip.kind !== "audio";
    const isTextClip = clip.kind === "text";

    return (
        <aside
            style={{
                width: PANEL_W,
                flexShrink: 0,
                boxSizing: "border-box",
                background: "var(--color-ae-lane, #101212)",
                borderLeft:
                    "1px solid var(--color-ae-border, rgba(255,255,255,0.06))",
                overflowY: "auto",
                overflowX: "hidden",
                color: "rgba(255,255,255,0.85)",
            }}
            className="scrollbar-dark"
            aria-label="Clip properties"
        >
            <header
                style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    boxSizing: "border-box",
                }}
            >
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h2
                        style={{
                            margin: 0,
                            fontSize: 14,
                            fontWeight: 600,
                            textTransform: "capitalize",
                        }}
                    >
                        {clip.kind} clip
                    </h2>
                    <div
                        style={{
                            marginTop: 4,
                            fontSize: 11,
                            color: "rgba(255,255,255,0.45)",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {clip.duration.toFixed(2)}s long · starts at{" "}
                        {clip.start.toFixed(2)}s
                    </div>
                </div>
                <CollapseToggle
                    direction="collapse"
                    onClick={() => setCollapsed(true)}
                />
            </header>

            {hasAudioControls && (
                <Section title="Audio">
                    <Slider
                        label="Volume"
                        min={0}
                        max={2}
                        step={0.01}
                        unit="x"
                        value={clip.volume}
                        onChange={(v) =>
                            updateClip(clip.id, { volume: v } as Partial<Clip>)
                        }
                    />
                    <Slider
                        label="Fade in"
                        min={0}
                        max={5}
                        step={0.05}
                        unit="s"
                        value={clip.fadeIn}
                        onChange={(v) =>
                            updateClip(clip.id, { fadeIn: v } as Partial<Clip>)
                        }
                    />
                    <Slider
                        label="Fade out"
                        min={0}
                        max={5}
                        step={0.05}
                        unit="s"
                        value={clip.fadeOut}
                        onChange={(v) =>
                            updateClip(clip.id, {
                                fadeOut: v,
                            } as Partial<Clip>)
                        }
                    />
                </Section>
            )}

            {hasVisualControls && !isTextClip && (
                <Section title="Speed">
                    <Slider
                        label="Playback speed"
                        min={0.25}
                        max={4}
                        step={0.05}
                        unit="x"
                        value={clip.speed}
                        onChange={(v) =>
                            updateClip(clip.id, { speed: v } as Partial<Clip>)
                        }
                    />
                </Section>
            )}

            {hasVisualControls && (
                <Section title="Transform">
                    {/* `minWidth: 0` on the grid lets the cells (and the
                        number inputs inside them) shrink below their
                        intrinsic widths so they fit within the panel. */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                            minWidth: 0,
                        }}
                    >
                        <NumberInput
                            label="X"
                            value={Math.round(clip.transform.x)}
                            onChange={(v) =>
                                updateClipTransform(clip.id, { x: v })
                            }
                        />
                        <NumberInput
                            label="Y"
                            value={Math.round(clip.transform.y)}
                            onChange={(v) =>
                                updateClipTransform(clip.id, { y: v })
                            }
                        />
                    </div>
                    <Slider
                        label="Scale"
                        min={0.05}
                        max={4}
                        step={0.01}
                        unit="x"
                        value={clip.transform.scale}
                        onChange={(v) =>
                            updateClipTransform(clip.id, { scale: v })
                        }
                    />
                    <Slider
                        label="Rotation"
                        min={-180}
                        max={180}
                        step={1}
                        unit="°"
                        value={clip.transform.rotation}
                        onChange={(v) =>
                            updateClipTransform(clip.id, { rotation: v })
                        }
                    />
                    <Slider
                        label="Opacity"
                        min={0}
                        max={1}
                        step={0.01}
                        unit=""
                        value={clip.transform.opacity}
                        onChange={(v) =>
                            updateClipTransform(clip.id, { opacity: v })
                        }
                    />
                    <div style={{ display: "flex", gap: 8, minWidth: 0 }}>
                        <Toggle
                            label="Flip H"
                            value={clip.transform.flipX}
                            onChange={(v) =>
                                updateClipTransform(clip.id, { flipX: v })
                            }
                        />
                        <Toggle
                            label="Flip V"
                            value={clip.transform.flipY}
                            onChange={(v) =>
                                updateClipTransform(clip.id, { flipY: v })
                            }
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

/* ─── Collapsed rail ──────────────────────────────────────────────────── */

/**
 * Thin always-visible rail shown when the user has collapsed the panel.
 * Carries the expand button and a vertically-oriented "Properties" label
 * so the affordance is discoverable without re-selecting a clip.
 */
function CollapsedRail({ onExpand }: { onExpand: () => void }) {
    return (
        <aside
            style={{
                width: COLLAPSED_W,
                flexShrink: 0,
                boxSizing: "border-box",
                background: "var(--color-ae-lane, #101212)",
                borderLeft:
                    "1px solid var(--color-ae-border, rgba(255,255,255,0.06))",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "8px 0",
                gap: 12,
                color: "rgba(255,255,255,0.6)",
            }}
            aria-label="Clip properties (collapsed)"
        >
            <CollapseToggle direction="expand" onClick={onExpand} />
            <div
                aria-hidden
                style={{
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.35)",
                    /* Reading bottom-to-top is the convention for vertical
                       labels in dark UI rails (DaVinci, Premiere, Ableton). */
                    writingMode: "vertical-rl",
                    transform: "rotate(180deg)",
                    userSelect: "none",
                }}
            >
                Properties
            </div>
        </aside>
    );
}

/**
 * Collapse / expand chevron. Same shape used in both header (collapse,
 * pointing right) and rail (expand, pointing left), so the icon "leaves
 * a trail" in the user's mental model: it always points toward where
 * the content currently is.
 */
function CollapseToggle({
    direction,
    onClick,
}: {
    direction: "collapse" | "expand";
    onClick: () => void;
}) {
    const isCollapse = direction === "collapse";
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={isCollapse ? "Collapse properties panel" : "Expand properties panel"}
            title={isCollapse ? "Collapse" : "Expand"}
            style={{
                width: 22,
                height: 22,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 5,
                border: "none",
                background: "transparent",
                color: "rgba(255,255,255,0.55)",
                cursor: "pointer",
                flexShrink: 0,
                transition: "color 120ms, background-color 120ms",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.backgroundColor =
                    "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.55)";
                e.currentTarget.style.backgroundColor = "transparent";
            }}
        >
            <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                {isCollapse ? (
                    /* Chevron pointing right — "fold the panel in this direction." */
                    <polyline points="9 6 15 12 9 18" />
                ) : (
                    /* Chevron pointing left — "the panel will open this way." */
                    <polyline points="15 6 9 12 15 18" />
                )}
            </svg>
        </button>
    );
}

/* ─── Atoms ──────────────────────────────────────────────────────────── */

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div
            style={{
                padding: "12px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                boxSizing: "border-box",
                minWidth: 0,
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
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    minWidth: 0,
                }}
            >
                {children}
            </div>
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
        <label
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                minWidth: 0,
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                }}
            >
                <span style={{ color: "rgba(255,255,255,0.55)" }}>{label}</span>
                <span
                    style={{
                        color: "rgba(255,255,255,0.85)",
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
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
                /* Native range inputs default to ~150px wide; constrain to
                   the parent so they don't push the panel out and provoke
                   a horizontal scrollbar. */
                style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}
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
        <label
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                minWidth: 0,
            }}
        >
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                {label}
            </span>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                style={{
                    width: "100%",
                    minWidth: 0,
                    boxSizing: "border-box",
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
                minWidth: 0,
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
                boxSizing: "border-box",
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
                onChange={(e) =>
                    updateClip({ style: { ...s, text: e.target.value } })
                }
                style={{
                    width: "100%",
                    minWidth: 0,
                    boxSizing: "border-box",
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
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    minWidth: 0,
                }}
            >
                <NumberInput
                    label="Font size"
                    value={s.fontSize}
                    onChange={(v) =>
                        updateClip({ style: { ...s, fontSize: v } })
                    }
                />
                <NumberInput
                    label="Weight"
                    value={s.fontWeight}
                    onChange={(v) =>
                        updateClip({ style: { ...s, fontWeight: v } })
                    }
                />
            </div>
            <label
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    minWidth: 0,
                }}
            >
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                    Color
                </span>
                <input
                    type="color"
                    value={s.color}
                    onChange={(e) =>
                        updateClip({ style: { ...s, color: e.target.value } })
                    }
                    style={{
                        width: "100%",
                        minWidth: 0,
                        boxSizing: "border-box",
                        height: 32,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 6,
                    }}
                />
            </label>
            <div style={{ display: "flex", gap: 4, minWidth: 0 }}>
                {(["left", "center", "right"] as const).map((a) => (
                    <button
                        key={a}
                        type="button"
                        onClick={() =>
                            updateClip({ style: { ...s, align: a } })
                        }
                        style={{
                            flex: 1,
                            minWidth: 0,
                            height: 28,
                            fontSize: 11,
                            textTransform: "capitalize",
                            borderRadius: 6,
                            border:
                                s.align === a
                                    ? "1px solid rgba(255,255,255,0.45)"
                                    : "1px solid rgba(255,255,255,0.08)",
                            background:
                                s.align === a
                                    ? "rgba(255,255,255,0.10)"
                                    : "transparent",
                            color:
                                s.align === a ? "#fff" : "rgba(255,255,255,0.7)",
                            cursor: "pointer",
                            boxSizing: "border-box",
                        }}
                    >
                        {a}
                    </button>
                ))}
            </div>
        </Section>
    );
}
