"use client";

import { clock } from "./clock";
import { useEditor } from "./store";

/**
 * Lane-scroller zoom helper.
 *
 * The audio timeline has multiple zoom entry points (wheel/pinch, +/- buttons,
 * keyboard shortcuts) spread across components. They all want the same UX:
 * zooming pivots around the playhead so its on-screen position stays put.
 * This module owns the small DOM bookkeeping required to make that work
 * consistently from every call site.
 *
 * The active lane scroller registers its element here on mount; any zoom
 * helper that wants playhead-anchored scroll uses it. When no scroller is
 * registered (e.g. on routes without the audio editor), the helpers
 * gracefully fall back to a plain `setZoom`.
 */

let _laneScroller: HTMLElement | null = null;

/** Called by the desktop lane scroller on mount/unmount. */
export function registerLaneScroller(el: HTMLElement | null): void {
  _laneScroller = el;
}

/**
 * Apply a new zoom level while keeping the playhead anchored:
 *   • visible playhead → stays at the same viewport X position
 *   • off-screen playhead → recenters in the viewport so the user lands
 *     on the focal point of the zoom they requested
 *
 * Falls back to `setZoom` alone when no lane scroller is registered.
 */
export function zoomAroundPlayhead(nextZoom: number): void {
  const el = _laneScroller;
  const setZoom = useEditor.getState().setZoom;
  if (!el) {
    setZoom(nextZoom);
    return;
  }
  const oldZoom = useEditor.getState().zoom;
  const playheadT = clock.time();
  const oldPxFromLeft = playheadT * oldZoom - el.scrollLeft;
  const viewportW = el.clientWidth;
  const playheadInView = oldPxFromLeft >= 0 && oldPxFromLeft <= viewportW;
  const targetPx = playheadInView ? oldPxFromLeft : viewportW / 2;

  setZoom(nextZoom);
  /* setZoom triggers React state, contentWidth depends on the new zoom,
     and scrollLeft can only extend once the wider content commits — so
     we wait one frame before assigning. Read the post-clamp zoom from
     the store rather than `nextZoom` so floor/ceiling clamps don't
     produce a stale offset. */
  requestAnimationFrame(() => {
    if (!_laneScroller) return;
    const committedZoom = useEditor.getState().zoom;
    _laneScroller.scrollLeft = Math.max(0, playheadT * committedZoom - targetPx);
  });
}

/** Multiply the current zoom by `factor`, anchored on the playhead. */
export function zoomByFactor(factor: number): void {
  zoomAroundPlayhead(useEditor.getState().zoom * factor);
}
