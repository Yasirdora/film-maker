import type { Clip } from "./types";

/** Pixels within which a drag snaps to a target at the current zoom level. */
const SNAP_PX = 10;

/**
 * Collect all snap-worthy time positions from the current project state.
 * Excludes the clip currently being dragged so it can't snap to itself.
 */
export function collectSnapTargets(
  clips: Record<string, Clip>,
  clipOrder: string[],
  draggingClipId: string,
  playhead: number,
): number[] {
  const targets = new Set<number>();

  /* Timeline origin is always a snap target. */
  targets.add(0);

  /* Playhead — skip when the playhead itself is the dragger,
     otherwise it would snap to its own position. */
  if (draggingClipId !== "__playhead__") targets.add(playhead);

  /* Every other clip's start and end. */
  for (const id of clipOrder) {
    if (id === draggingClipId) continue;
    const c = clips[id];
    if (!c) continue;
    targets.add(c.start);
    targets.add(c.start + c.duration);
  }

  return Array.from(targets);
}

/**
 * Snap `t` to the nearest target if it falls within the threshold.
 * Returns `{ snapped, indicator }` — `indicator` is the snap position
 * to display (null when no snap engaged).
 */
export function snapTime(
  t: number,
  targets: number[],
  zoom: number,
): { snapped: number; indicator: number | null } {
  const threshold = SNAP_PX / zoom;
  let best = t;
  let bestDist = threshold;
  let indicator: number | null = null;

  for (const target of targets) {
    const dist = Math.abs(t - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = target;
      indicator = target;
    }
  }

  return { snapped: best, indicator };
}
