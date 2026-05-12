"use client";

/**
 * Splitter — resizable two-pane layout primitive.
 *
 * Drops a draggable handle between two children and lets the user adjust
 * their relative sizes. Vertical orientation stacks the children top/bottom
 * with a horizontal handle (the video editor's preview / timeline split);
 * horizontal orientation lays them out left/right with a vertical handle.
 *
 * Behavior contract
 * -----------------
 * • Pointer drag (mouse, touch, pen) updates the split live; on release
 *   the final ratio is persisted to `localStorage` under `storageKey`,
 *   keyed per usage so different splits don't fight over the same slot.
 * • Keyboard accessible: focus the handle and use Arrow keys to nudge by
 *   `keyboardStep` (Shift = `keyboardLargeStep`), Home/End jump to the
 *   min/max bounds.
 * • Double-click the handle to reset the ratio to `defaultRatio`.
 * • The handle reports its state via `role="separator"` + `aria-valuenow`
 *   in percent, which assistive tech reads out as a percentage value.
 * • All ratios are clamped to `[minRatio, maxRatio]` so neither pane can
 *   collapse to zero — the user can always grab the handle to recover.
 * • SSR safe: the server renders at `defaultRatio` and the client
 *   hydrates the persisted value on first paint (useLayoutEffect), so
 *   there is no layout flash between the default and the stored value.
 *
 * Layout contract
 * ---------------
 * The Splitter itself is `display: flex` (column or row depending on
 * orientation) and fills its parent. Each pane is a flex item with an
 * explicit `flex-basis` derived from the current ratio; the trailing
 * pane has `flex-grow: 1` so any sub-pixel rounding remainder lands in
 * one place rather than producing a visible gap.
 *
 * Children are expected to be self-sizing flex contents (`flex-1` or
 * absolute layouts). The Splitter does not enforce `overflow` on the
 * panes — that's the consumer's responsibility, since some content
 * (e.g. menus that escape the pane) deliberately overflows.
 */

import {
    type KeyboardEvent,
    type PointerEvent,
    type ReactElement,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

type Orientation = "vertical" | "horizontal";

export interface SplitterProps {
    /**
     * `vertical` stacks children top → bottom with a horizontal drag
     * handle between them. `horizontal` lays them out left → right with
     * a vertical drag handle.
     */
    orientation: Orientation;
    /**
     * The two panes. The first child is the leading pane (top in
     * vertical, left in horizontal); the second is the trailing pane.
     * Exactly two children are required.
     */
    children: [ReactElement, ReactElement];
    /**
     * Optional localStorage key — when set, the user's chosen ratio is
     * remembered between visits. Distinct splits MUST use distinct keys.
     */
    storageKey?: string;
    /** Starting size of the leading pane as a fraction of the total. */
    defaultRatio?: number;
    /** Lower bound on the leading pane's ratio. */
    minRatio?: number;
    /** Upper bound on the leading pane's ratio. */
    maxRatio?: number;
    /** Arrow-key step (in ratio units, e.g. 0.02 = 2%). */
    keyboardStep?: number;
    /** Shift + Arrow step. */
    keyboardLargeStep?: number;
    /**
     * Accessible label for the drag handle. Defaults to "Resize panels".
     * Override per consumer so screen readers announce which split.
     */
    handleLabel?: string;
    /** Optional className applied to the root flex container. */
    className?: string;
}

/* ─── Defaults ───────────────────────────────────────────────────────── */

const DEFAULT_RATIO = 0.5;
const DEFAULT_MIN = 0.15;
const DEFAULT_MAX = 0.85;
const DEFAULT_STEP = 0.02;
const DEFAULT_LARGE_STEP = 0.1;

/** Thickness of the handle hit area in pixels. */
const HANDLE_THICKNESS = 2;

/* ─── Helpers ───────────────────────────────────────────────────────── */

function clamp(n: number, min: number, max: number): number {
    return Math.min(Math.max(n, min), max);
}

/**
 * Reads a persisted ratio from localStorage. Returns `fallback` when no
 * value is stored, the entry is unparseable, or storage is unavailable
 * (private mode, quota error, server runtime).
 */
function loadStoredRatio(key: string | undefined, fallback: number): number {
    if (!key || typeof window === "undefined") return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return fallback;
        const n = parseFloat(raw);
        return Number.isFinite(n) ? n : fallback;
    } catch {
        return fallback;
    }
}

/**
 * Persists a ratio to localStorage. Swallows any error — persistence is
 * best-effort and never blocks the UI.
 */
function persistRatio(key: string | undefined, ratio: number): void {
    if (!key || typeof window === "undefined") return;
    try {
        window.localStorage.setItem(key, ratio.toFixed(4));
    } catch {
        /* quota exceeded / private mode — non-fatal */
    }
}

/* ─── Splitter ───────────────────────────────────────────────────────── */

export default function Splitter({
    orientation,
    children,
    storageKey,
    defaultRatio = DEFAULT_RATIO,
    minRatio = DEFAULT_MIN,
    maxRatio = DEFAULT_MAX,
    keyboardStep = DEFAULT_STEP,
    keyboardLargeStep = DEFAULT_LARGE_STEP,
    handleLabel = "Resize panels",
    className,
}: SplitterProps) {
    const isVertical = orientation === "vertical";
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [ratio, setRatio] = useState<number>(() =>
        clamp(defaultRatio, minRatio, maxRatio),
    );
    const [dragging, setDragging] = useState(false);

    /* Hydrate the persisted ratio on first client paint. Doing this in a
       layout effect (rather than at useState time) keeps the initial SSR
       markup deterministic and avoids a paint flash from default → stored. */
    useLayoutEffect(() => {
        const stored = loadStoredRatio(storageKey, defaultRatio);
        setRatio(clamp(stored, minRatio, maxRatio));
    // The ratio is only ever (re)hydrated from storage when the storage
    // key or the bounds change; intentionally excluding `defaultRatio`
    // here would let consumers' inline-literal objects retrigger reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storageKey, minRatio, maxRatio]);

    /* `commitRatio` is the single internal write path. It clamps, updates
       state, and (when a storageKey is provided) persists. Pointer drag
       persists on release for fewer writes; keyboard / double-click
       persist immediately because each action is already discrete. */
    const commitRatio = useCallback(
        (next: number, options: { persist: boolean } = { persist: true }) => {
            const clamped = clamp(next, minRatio, maxRatio);
            setRatio(clamped);
            if (options.persist) persistRatio(storageKey, clamped);
        },
        [minRatio, maxRatio, storageKey],
    );

    /* ── Pointer handlers ────────────────────────────────────────────── */

    const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
        /* Only the primary pointer initiates a drag — ignore right-click,
           middle-click, and any subsequent touch points during a drag. */
        if (event.button !== 0 && event.pointerType === "mouse") return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
    }, []);

    const onPointerMove = useCallback(
        (event: PointerEvent<HTMLDivElement>) => {
            if (!dragging) return;
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const size = isVertical ? rect.height : rect.width;
            if (size <= 0) return;
            const offset = isVertical
                ? event.clientY - rect.top
                : event.clientX - rect.left;
            /* Drag updates are not persisted — only the final release is.
               This keeps the localStorage write count bounded by user
               interactions, not by frame rate. */
            commitRatio(offset / size, { persist: false });
        },
        [dragging, isVertical, commitRatio],
    );

    const endDrag = useCallback(
        (event: PointerEvent<HTMLDivElement>) => {
            if (!dragging) return;
            try {
                event.currentTarget.releasePointerCapture(event.pointerId);
            } catch {
                /* Pointer already released — non-fatal. */
            }
            setDragging(false);
            persistRatio(storageKey, ratio);
        },
        [dragging, storageKey, ratio],
    );

    /* ── Keyboard handler ────────────────────────────────────────────── */

    const onKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            const step = event.shiftKey ? keyboardLargeStep : keyboardStep;
            let next: number | null = null;

            switch (event.key) {
                /* In vertical orientation, ArrowDown grows the leading
                   (top) pane; in horizontal, ArrowRight grows the leading
                   (left) pane. ArrowUp / ArrowLeft do the inverse. */
                case "ArrowDown":
                case "ArrowRight":
                    next = ratio + step;
                    break;
                case "ArrowUp":
                case "ArrowLeft":
                    next = ratio - step;
                    break;
                case "Home":
                    next = minRatio;
                    break;
                case "End":
                    next = maxRatio;
                    break;
                case "Enter":
                case " ":
                    /* Reset is also wired to double-click; mirror it for
                       keyboard users who can't easily double-tap. */
                    next = defaultRatio;
                    break;
                default:
                    return;
            }

            event.preventDefault();
            commitRatio(next);
        },
        [
            ratio,
            keyboardStep,
            keyboardLargeStep,
            minRatio,
            maxRatio,
            defaultRatio,
            commitRatio,
        ],
    );

    const onDoubleClick = useCallback(() => {
        commitRatio(defaultRatio);
    }, [commitRatio, defaultRatio]);

    /* ── Drag-state side effects ─────────────────────────────────────── */

    /* While dragging, override the body cursor so the user sees the
       resize cursor anywhere on screen — not just while hovering the
       1px handle line. Cleared on every drag-end path (pointerup, lost
       capture, unmount). */
    useEffect(() => {
        if (!dragging) return;
        const prev = document.body.style.cursor;
        document.body.style.cursor = isVertical ? "row-resize" : "col-resize";
        return () => {
            document.body.style.cursor = prev;
        };
    }, [dragging, isVertical]);

    /* ── Render ──────────────────────────────────────────────────────── */

    const leadingPercent = ratio * 100;
    const trailingPercent = (1 - ratio) * 100;
    const ariaValueNow = Math.round(leadingPercent);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                display: "flex",
                flexDirection: isVertical ? "column" : "row",
                width: "100%",
                height: "100%",
                minWidth: 0,
                minHeight: 0,
            }}
        >
            <div
                style={{
                    flexBasis: `${leadingPercent}%`,
                    flexGrow: 0,
                    flexShrink: 0,
                    minWidth: 0,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                }}
            >
                {children[0]}
            </div>

            <div
                role="separator"
                aria-orientation={isVertical ? "horizontal" : "vertical"}
                aria-valuenow={ariaValueNow}
                aria-valuemin={Math.round(minRatio * 100)}
                aria-valuemax={Math.round(maxRatio * 100)}
                aria-label={handleLabel}
                tabIndex={0}
                data-dragging={dragging || undefined}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onLostPointerCapture={endDrag}
                onKeyDown={onKeyDown}
                onDoubleClick={onDoubleClick}
                className="group relative shrink-0 outline-none"
                style={{
                    touchAction: "none",
                    cursor: isVertical ? "row-resize" : "col-resize",
                    /* Hit area is wider than the visible line so the handle
                       is easy to grab without being visually heavy. */
                    width: isVertical ? "100%" : HANDLE_THICKNESS,
                    height: isVertical ? HANDLE_THICKNESS : "100%",
                    /* Sit above adjacent overlay shadows so the cursor
                       resolves correctly on hover. */
                    zIndex: 1,
                }}
            >
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                    <div
                        className={[
                            "rounded-[1px] bg-white/10 transition-colors duration-150",
                            "group-hover:bg-white/30 group-focus-visible:bg-white/40",
                            "group-data-[dragging]:bg-white/50",
                        ].join(" ")}
                        style={{
                            width: isVertical ? 40 : 2,
                            height: isVertical ? 2 : 40,
                        }}
                    />
                </div>
            </div>

            <div
                style={{
                    /* `flex-grow: 1` lets the trailing pane absorb any
                       sub-pixel rounding remainder from the leading
                       basis, so the two panes always tile the container
                       exactly with no visible gap. */
                    flexBasis: `${trailingPercent}%`,
                    flexGrow: 1,
                    flexShrink: 1,
                    minWidth: 0,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                }}
            >
                {children[1]}
            </div>
        </div>
    );
}
