"use client";

/**
 * PhotoEditor — body of the /editor/photo route.
 *
 * Two states, both rendered in the same container so the surrounding
 * chrome (PageBar, side rail) keeps its layout identical:
 *
 *   • Empty — a centered drop zone. Click opens a file picker; drag &
 *     drop accepts the first supported image. Drag-over highlights
 *     the zone so the user knows the drop is going to land here and
 *     not somewhere else on the page.
 *
 *   • Loaded — the image rendered inside a pan/zoom viewport with a
 *     floating HUD in the bottom-right offering zoom out / 100% /
 *     zoom in / fit. Wheel zooms around the cursor; drag pans; double
 *     click resets to "fit". Same gesture set every desktop image
 *     editor ships, so the rail is one-to-one familiar.
 *
 * Drag-and-drop is wired at the container level (not the body) so the
 * user can drop anywhere over the canvas, not just on the visible
 * drop-zone pill in the empty state. The `dragenter` / `dragleave`
 * pair is counted with a depth ref so child-element transitions don't
 * flicker the highlight state — a single child move would otherwise
 * fire both events in sequence and toggle the visual.
 *
 * Image state + decoding live in the parent (`PhotoEditorMount`) so
 * the PageBar's Export button sees the same `LoadedImage` and we avoid
 * a second decode pipeline here. View state (zoom / pan) lives here
 * because nothing outside the viewport needs to read it.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { LoadedImage } from "@/lib/editor/photo";

interface PhotoEditorProps {
    /** Current loaded image, or null when the editor is in empty state. */
    image: LoadedImage | null;
    /** Hand a chosen / dropped file up to the parent for decoding. */
    onFile: (file: File) => void;
}

export default function PhotoEditor({ image, onFile }: PhotoEditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    /* Depth counter so nested `dragenter`/`dragleave` events from
       children don't flicker `isDragOver` while the cursor is still
       inside the zone. */
    const dragDepthRef = useRef(0);

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            /* Reset so re-picking the same file fires `change` again. */
            e.target.value = "";
            if (file) onFile(file);
        },
        [onFile],
    );

    const openPicker = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const onDragEnter = useCallback((e: React.DragEvent) => {
        if (!hasFiles(e.dataTransfer)) return;
        e.preventDefault();
        dragDepthRef.current += 1;
        if (dragDepthRef.current === 1) setIsDragOver(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        if (!hasFiles(e.dataTransfer)) return;
        e.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setIsDragOver(false);
    }, []);

    /* `dragover` is required (with `preventDefault`) for the drop to
       actually be allowed by the browser. Without it `drop` never
       fires. */
    const onDragOver = useCallback((e: React.DragEvent) => {
        if (!hasFiles(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    }, []);

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            if (!hasFiles(e.dataTransfer)) return;
            e.preventDefault();
            dragDepthRef.current = 0;
            setIsDragOver(false);
            const file = e.dataTransfer.files[0];
            /* Validation + decode happen in the parent — the body just
               forwards the raw `File`. */
            if (file) onFile(file);
        },
        [onFile],
    );

    return (
        <div
            className="relative flex h-full w-full items-center justify-center overflow-hidden"
            style={{ background: "var(--color-ae-bg, #000)" }}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            {/* Hidden picker — the only thing in the empty-state tree
                that opens a native file dialog. The PageBar's "Open"
                button has its own picker for the loaded state, since
                both surfaces want to live independently. */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp"
                onChange={handleFileInput}
                style={{ display: "none" }}
                aria-hidden
            />

            {image ? (
                <ImageStage image={image} />
            ) : (
                <EmptyState onOpenPicker={openPicker} isDragOver={isDragOver} />
            )}

            {/* When a drop is in progress on a loaded image we still
                want a clear visual signal that the drop will land. A
                full-bleed translucent overlay sits above the image only
                while `isDragOver` is true. */}
            {image && isDragOver && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-sm">
                    <div className="rounded-2xl border border-dashed border-white/30 bg-white/[0.04] px-6 py-4 text-[14px] text-white/90">
                        Drop to replace the current image
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Loaded state ─────────────────────────────────────────────────── */

/**
 * Scale is expressed as a multiplier on the *fit* scale — the natural
 * factor that makes the image fill the container without cropping. At
 * `scale = 1` the image fills the viewport ("Fit"); at the value
 * returned by `actualSizeScale(...)` one image pixel equals one CSS
 * pixel ("100%"); higher values zoom further in. The math stays
 * legible because every helper works in this normalised space rather
 * than juggling raw pixel sizes.
 */
/* Bounds expressed in *displayed* percent (1 = 100% = one image pixel
 * per CSS pixel). Holding the limit in display terms rather than in
 * view-scale units keeps the user-visible range stable across container
 * sizes — a 4K image and a 200×200 thumbnail both stop at the same
 * 10% / 900% the user sees in the HUD. */
const MIN_DISPLAY = 0.1; //  10%
const MAX_DISPLAY = 9; // 900%
const WHEEL_ZOOM_STEP = 1.0015; // per pixel of deltaY — feels right on both trackpads and mice
const BUTTON_ZOOM_STEP = 1.25;

interface ViewState {
    scale: number;
    offsetX: number;
    offsetY: number;
}

const FIT_VIEW: ViewState = { scale: 1, offsetX: 0, offsetY: 0 };

/**
 * Everything `clampView` needs to compute valid offsets: the image's
 * fit-to-container ratio, the image's natural dimensions, and the
 * container's current pixel size. Grouped into one object so the math
 * helpers (`zoomBy`, `zoomAroundPoint`) keep a tidy signature.
 */
interface ViewBounds {
    fitRatio: number;
    imageW: number;
    imageH: number;
    containerW: number;
    containerH: number;
}

function ImageStage({ image }: { image: LoadedImage }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [view, setView] = useState<ViewState>(FIT_VIEW);
    const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({
        w: 0,
        h: 0,
    });

    /* Reset view whenever a new image is loaded so the user always
       sees the whole frame first. `image.bitmap` is the most precise
       identity — the URL changes too. */
    useEffect(() => {
        setView(FIT_VIEW);
    }, [image.bitmap]);

    /* Observe the container size so the zoom-around-cursor math has
       accurate dimensions. ResizeObserver is supported everywhere
       except very old Safari we don't target. */
    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const update = () => {
            const rect = el.getBoundingClientRect();
            setContainerSize({ w: rect.width, h: rect.height });
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    /* Fit ratio: the multiplier from natural pixels to "fits container
       at scale=1". Used by the HUD's 100% control to compute the
       multiplier that produces 1:1 pixel mapping, and by the export
       button label / status badge if we ever surface it. */
    const fitRatio = computeFitRatio(image, containerSize);

    /* Bundle of everything `clampView` needs. Recomputed each render —
       cheap, but `useMemo`d to give the math helpers a stable
       reference. */
    const bounds: ViewBounds = {
        fitRatio,
        imageW: image.width,
        imageH: image.height,
        containerW: containerSize.w,
        containerH: containerSize.h,
    };

    /* Re-clamp the existing view whenever the container resizes —
       otherwise a window shrink could leave the image stranded
       outside the viewport with no way to drag it back. The clamp
       is idempotent so the no-op case doesn't trigger an extra
       render. */
    useEffect(() => {
        setView((prev) => {
            const next = clampView(prev, bounds);
            return next === prev ||
                (next.scale === prev.scale &&
                    next.offsetX === prev.offsetX &&
                    next.offsetY === prev.offsetY)
                ? prev
                : next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [containerSize.w, containerSize.h, fitRatio]);

    /* ── Wheel zoom (focal point = cursor) ──────────────────────── */

    const onWheel = useCallback(
        (e: React.WheelEvent<HTMLDivElement>) => {
            /* The browser scrolls the page on bare wheel events; we
               consume them all here because the photo viewport has no
               scroll of its own. */
            e.preventDefault();
            const el = containerRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const cursorX = e.clientX - rect.left - rect.width / 2;
            const cursorY = e.clientY - rect.top - rect.height / 2;
            setView((prev) =>
                zoomAroundPoint(prev, cursorX, cursorY, e.deltaY, bounds),
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [bounds.fitRatio, bounds.imageW, bounds.imageH, bounds.containerW, bounds.containerH],
    );

    /* ── Drag to pan ────────────────────────────────────────────── */

    const dragRef = useRef<{
        startX: number;
        startY: number;
        startOffsetX: number;
        startOffsetY: number;
        pointerId: number;
    } | null>(null);

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            /* Only the primary button (left mouse / touch) starts a
               pan. Right-click is reserved for the (future) viewport
               context menu. */
            if (e.button !== 0) return;
            const el = containerRef.current;
            if (!el) return;
            el.setPointerCapture(e.pointerId);
            dragRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                startOffsetX: view.offsetX,
                startOffsetY: view.offsetY,
                pointerId: e.pointerId,
            };
        },
        [view.offsetX, view.offsetY],
    );

    const onPointerMove = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const d = dragRef.current;
            if (!d || d.pointerId !== e.pointerId) return;
            setView((prev) =>
                clampView(
                    {
                        scale: prev.scale,
                        offsetX: d.startOffsetX + (e.clientX - d.startX),
                        offsetY: d.startOffsetY + (e.clientY - d.startY),
                    },
                    bounds,
                ),
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [bounds.fitRatio, bounds.imageW, bounds.imageH, bounds.containerW, bounds.containerH],
    );

    const endDrag = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const d = dragRef.current;
            if (!d || d.pointerId !== e.pointerId) return;
            containerRef.current?.releasePointerCapture(e.pointerId);
            dragRef.current = null;
        },
        [],
    );

    /* ── HUD controls ───────────────────────────────────────────── */

    /* "Click %" is a toggle with one-deep memory:
       - At any zoom other than 100%, clicking snaps to 100% (1:1
         pixel mapping) and remembers the view you came from.
       - At exactly 100%, clicking restores the remembered view
         (returning you to whatever you had before the snap).
       Manual zoom actions (wheel, +/-) don't touch the memory — only
       successive clicks on the % button consume / refill it. That
       keeps the "bounce between two zooms" gesture predictable
       without making other actions feel like they're erasing state. */
    const savedViewRef = useRef<ViewState | null>(null);
    const fit = useCallback(() => setView(FIT_VIEW), []);
    const togglePercent = useCallback(() => {
        if (fitRatio <= 0) return;
        setView((prev) => {
            const atHundred =
                Math.round(prev.scale * fitRatio * 100) === 100;
            if (atHundred && savedViewRef.current) {
                const restored = savedViewRef.current;
                savedViewRef.current = null;
                return restored;
            }
            savedViewRef.current = prev;
            return { scale: 1 / fitRatio, offsetX: 0, offsetY: 0 };
        });
    }, [fitRatio]);
    const zoomIn = useCallback(() => {
        setView((prev) => zoomBy(prev, BUTTON_ZOOM_STEP, bounds));
    }, [bounds]);
    const zoomOut = useCallback(() => {
        setView((prev) => zoomBy(prev, 1 / BUTTON_ZOOM_STEP, bounds));
    }, [bounds]);

    /* Double-click resets to fit — fastest "lose me back to the start"
       gesture in every editor that supports zoom. */
    const onDoubleClick = useCallback(() => {
        fit();
    }, [fit]);

    /* Cursor switches between grab / grabbing depending on whether a
       pan is in progress, so the affordance matches the action. */
    const isDragging = dragRef.current !== null;

    /* Percentage shown in the HUD: 100% = 1:1 pixel mapping, which
       corresponds to `view.scale * fitRatio === 1`. */
    const displayPercent = Math.round(view.scale * fitRatio * 100);

    return (
        <div
            ref={containerRef}
            className="relative h-full w-full"
            style={{
                touchAction: "none",
                cursor: isDragging ? "grabbing" : "grab",
            }}
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={onDoubleClick}
        >
            {/* Image is centered in the container, then transformed.
                `transform-origin: center` so scale grows symmetrically
                around the centre; the offset translation positions the
                centre wherever the user has panned to. */}
            <div className="absolute inset-0 flex items-center justify-center">
                <img
                    src={image.blobUrl}
                    alt={image.fileName}
                    draggable={false}
                    className="max-h-full max-w-full select-none object-contain"
                    style={{
                        transform: `translate(${view.offsetX}px, ${view.offsetY}px) scale(${view.scale})`,
                        transformOrigin: "center center",
                        /* When the user is actively dragging we want
                           absolutely no transition lag — every frame is
                           an exact match for the pointer position. */
                        transition: isDragging ? "none" : "transform 80ms ease-out",
                        willChange: "transform",
                    }}
                />
            </div>

            <ZoomHud
                percent={displayPercent}
                onZoomOut={zoomOut}
                onZoomIn={zoomIn}
                onTogglePercent={togglePercent}
            />
        </div>
    );
}

/* ── HUD ──────────────────────────────────────────────────────────── */

function ZoomHud({
    percent,
    onZoomOut,
    onZoomIn,
    onTogglePercent,
}: {
    percent: number;
    onZoomOut: () => void;
    onZoomIn: () => void;
    /** Snap to 100% (or restore the saved view if already at 100%). */
    onTogglePercent: () => void;
}) {
    /* Stop every input that the viewport listens for from bubbling out
       of the HUD. Without this:
         • `pointerdown` on a HUD button bubbles up to the viewport,
           which captures the pointer and starts a pan — a single-pixel
           cursor wobble during the click then registers as drag, not
           click, and the button silently "doesn't work".
         • `dblclick` on a HUD button would reset the view.
         • `wheel` over the HUD would zoom out from under the cursor
           while the user is reading the controls.
       Stopping propagation here keeps the HUD a fully self-contained
       island over the viewport. */
    const swallow = useCallback((e: React.SyntheticEvent) => {
        e.stopPropagation();
    }, []);

    return (
        <div
            className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-xl border border-white/[0.08] bg-black/60 p-1 text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
            style={{
                backdropFilter: "blur(12px) saturate(1.4)",
                WebkitBackdropFilter: "blur(12px) saturate(1.4)",
            }}
            onPointerDown={swallow}
            onPointerUp={swallow}
            onPointerMove={swallow}
            onDoubleClick={swallow}
            onWheel={swallow}
        >
            <HudButton label="Zoom out" onClick={onZoomOut}>
                <MinusGlyph />
            </HudButton>
            {/* Centre readout doubles as the 100% toggle: click once
                to snap to 100% (1:1 pixel mapping), click again to
                return to whatever view you came from. Wide enough for
                4 digits (1000%) so the rail's width doesn't twitch as
                the value changes during a pinch. */}
            <button
                type="button"
                onClick={onTogglePercent}
                aria-label={percent === 100 ? "Restore previous zoom" : "Zoom to 100%"}
                title={percent === 100 ? "Restore previous zoom" : "Zoom to 100%"}
                className="inline-flex items-center justify-center min-w-[52px] h-7 px-1 rounded-lg text-[12px] font-medium tabular-nums text-white/90 hover:bg-white/[0.08] transition-colors"
            >
                {percent}%
            </button>
            <HudButton label="Zoom in" onClick={onZoomIn}>
                <PlusGlyph />
            </HudButton>
        </div>
    );
}

function HudButton({
    label,
    onClick,
    children,
}: {
    label: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white/85 hover:text-white hover:bg-white/[0.08] transition-colors"
        >
            {children}
        </button>
    );
}

/* ── View math ────────────────────────────────────────────────────── */

/**
 * Clamp the view-scale so the resulting *displayed* percent stays
 * within `[MIN_DISPLAY, MAX_DISPLAY]`. We work in view-scale here (the
 * shape that `ViewState` carries) but the limits are converted from
 * percent via the current `fitRatio` so the user-facing range is
 * stable across image sizes. `fitRatio <= 0` happens for one frame
 * before the container is measured — fall back to identity so we
 * don't divide by zero or strand the user at an arbitrary scale.
 */
function clampScale(s: number, fitRatio: number): number {
    if (fitRatio <= 0) return s;
    const min = MIN_DISPLAY / fitRatio;
    const max = MAX_DISPLAY / fitRatio;
    return Math.min(max, Math.max(min, s));
}

/**
 * Multiplicative zoom around the container centre — used by the HUD's
 * +/- buttons. We don't need a focal point here because the user is
 * acting on the centre conceptually, and offsets stay where they were
 * (modulo the bounds clamp which re-centres if the new size shrinks
 * past the container).
 */
function zoomBy(prev: ViewState, factor: number, bounds: ViewBounds): ViewState {
    const nextScale = clampScale(prev.scale * factor, bounds.fitRatio);
    return clampView(
        { scale: nextScale, offsetX: prev.offsetX, offsetY: prev.offsetY },
        bounds,
    );
}

/**
 * Zoom around an arbitrary point (relative to the container centre).
 * The classic transform-origin trick: keep the image coordinate under
 * the cursor stationary while the scale changes. Solving for the new
 * offset:
 *
 *   pivot_in_image = (cursor - offset) / scale
 *   newOffset      = cursor - pivot_in_image * newScale
 *                  = cursor - (cursor - offset) * (newScale / scale)
 *
 * `deltaY` follows browser convention: positive = scroll down = zoom
 * out, negative = scroll up = zoom in. The result is clamped via
 * `clampView` so the image edge can't leave the viewport — the cursor
 * pivot still tracks as long as it's reachable, then snaps to the
 * boundary once the user pushes past it.
 */
function zoomAroundPoint(
    prev: ViewState,
    cursorX: number,
    cursorY: number,
    deltaY: number,
    bounds: ViewBounds,
): ViewState {
    const factor = Math.pow(WHEEL_ZOOM_STEP, -deltaY);
    const nextScale = clampScale(prev.scale * factor, bounds.fitRatio);
    if (nextScale === prev.scale) return prev;
    const k = nextScale / prev.scale;
    return clampView(
        {
            scale: nextScale,
            offsetX: cursorX - (cursorX - prev.offsetX) * k,
            offsetY: cursorY - (cursorY - prev.offsetY) * k,
        },
        bounds,
    );
}

/**
 * Constrain offsets so the rendered image never fully disappears off
 * the viewport. The rule is "keep at least `EDGE_MARGIN` CSS-pixels
 * of the image visible on each axis" — strict enough that the user
 * can't lose the image, loose enough that the pan feels free instead
 * of locked to the viewport corner.
 *
 * For a centred image at `(offsetX, offsetY)` whose displayed size is
 * `(displayedW, displayedH)`, the image's left/right edges sit at
 * `offsetX ± displayedW/2`. Requiring the right edge to be at least
 * `-containerW/2 + margin` (i.e. `margin` past the left wall of the
 * viewport) and the left edge to be at most `containerW/2 - margin`
 * yields a symmetric bound:
 *
 *   |offsetX|  ≤  (containerW + displayedW)/2 − margin
 *
 * For tiny displayed images we shrink the margin to half the image
 * so the bound never becomes negative (which would lock the offset
 * to 0). The user can still move a small image around the viewport;
 * it just won't be allowed to leave entirely.
 */
const EDGE_MARGIN = 240;

function clampView(view: ViewState, bounds: ViewBounds): ViewState {
    const { fitRatio, imageW, imageH, containerW, containerH } = bounds;
    if (fitRatio <= 0 || containerW <= 0 || containerH <= 0) return view;

    const displayedW = imageW * fitRatio * view.scale;
    const displayedH = imageH * fitRatio * view.scale;

    const marginX = Math.min(EDGE_MARGIN, displayedW / 2);
    const marginY = Math.min(EDGE_MARGIN, displayedH / 2);
    const maxX = (containerW + displayedW) / 2 - marginX;
    const maxY = (containerH + displayedH) / 2 - marginY;

    const offsetX = Math.min(maxX, Math.max(-maxX, view.offsetX));
    const offsetY = Math.min(maxY, Math.max(-maxY, view.offsetY));

    if (offsetX === view.offsetX && offsetY === view.offsetY) return view;
    return { scale: view.scale, offsetX, offsetY };
}

/**
 * `object-contain` scales the image to fit the container by the
 * smaller of width-ratio / height-ratio. Reproducing that here so the
 * "100%" button can compute the multiplier that returns 1:1 pixel
 * mapping. Falls back to 1 while the container size hasn't been
 * measured yet — the HUD just shows `100%` until the first layout
 * pass, which lands within a frame.
 */
function computeFitRatio(
    image: LoadedImage,
    container: { w: number; h: number },
): number {
    if (container.w <= 0 || container.h <= 0) return 1;
    return Math.min(container.w / image.width, container.h / image.height);
}

/* ── Glyphs ──────────────────────────────────────────────────────── */

function MinusGlyph() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    );
}

function PlusGlyph() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    );
}


/* ── Empty state ──────────────────────────────────────────────────── */

function EmptyState({
    onOpenPicker,
    isDragOver,
}: {
    onOpenPicker: () => void;
    isDragOver: boolean;
}) {
    return (
        <div className="flex flex-col items-center gap-6 px-6 text-center">
            <button
                type="button"
                onClick={onOpenPicker}
                className={`flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-12 py-12 transition-colors ${
                    isDragOver
                        ? "border-white/40 bg-white/[0.06]"
                        : "border-white/[0.12] bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]"
                }`}
                aria-label="Open an image"
            >
                <UploadGlyph />
                <div>
                    <div className="text-[15px] font-semibold text-white">
                        Drop an image or click to open
                    </div>
                    <div className="mt-1 text-[12px] text-white/55">
                        PNG, JPEG, WebP, GIF, AVIF, BMP
                    </div>
                </div>
            </button>
            <p className="max-w-[28rem] text-[12px] leading-relaxed text-white/40">
                Files never leave your device — every adjustment runs in your
                browser.
            </p>
        </div>
    );
}

function UploadGlyph() {
    return (
        <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="text-white/70"
        >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-5-5L5 21" />
        </svg>
    );
}

/* ── Helpers ──────────────────────────────────────────────────────── */

/**
 * Filter out drags that originate from within the page (text
 * selection, an internal <a> drag, etc.). Only file drags should
 * trigger the drop-zone affordance — otherwise the overlay flashes
 * every time the user drags a piece of text.
 */
function hasFiles(dt: DataTransfer | null): boolean {
    if (!dt) return false;
    /* `types` is the only property safe to read during `dragenter` /
     * `dragover`; `files` is empty on those events for security. */
    return Array.from(dt.types).includes("Files");
}
