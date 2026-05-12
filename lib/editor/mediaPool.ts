"use client";

import { audioCtx, getOrCreateSource, masterGain, trackBus } from "./audio";

/**
 * Per-clip cache of HTMLMediaElement + a Web Audio gain node.
 *
 * Why per-clip and not per-asset:
 *   Two clips can reference the same asset but be at different positions on
 *   the timeline (and may overlap). Each needs its own playback head.
 *
 * Why route through Web Audio:
 *   `HTMLMediaElement.volume` is spec-clamped to [0, 1]. To honor the editor's
 *   0..2 (200%) volume range — and to do clean fade in/out via `gain` ramps —
 *   we route every audible element through a GainNode.
 *
 * Why lazy:
 *   `MediaElementAudioSourceNode` construction "captures" an element's audio
 *   output. We only want to do this for elements that will actually produce
 *   sound (visible video clips on a non-muted track, or audio clips). Mute
 *   plain video (e.g. audio-detached) just means we never call `attachAudio`.
 */

export type PoolKind = "video" | "audio";

export type PoolEntry = {
  kind: PoolKind;
  el: HTMLMediaElement;
  /** Original src string passed to acquire — avoids resolved-URL mismatches. */
  originalSrc: string;
  gain: GainNode | null;
  source: MediaElementAudioSourceNode | null;
  /** Track this entry's audio is currently routed into (null = not routed). */
  routedTrackId: string | null;
  ready: boolean;
  /** Last time we issued a hard `currentTime` write — used to suppress jitter. */
  lastSeekAt: number;
};

const _entries = new Map<string, PoolEntry>();

function makeEntry(kind: PoolKind, src: string): PoolEntry {
  const el =
    kind === "video"
      ? Object.assign(document.createElement("video"), {
          crossOrigin: "anonymous",
          playsInline: true,
          preload: "auto",
          muted: true,
          // 100% pass-through to the audio graph (gain node controls volume).
          volume: 1,
        })
      : Object.assign(new Audio(), { crossOrigin: "anonymous", preload: "auto", volume: 1 });
  el.src = src;

  const entry: PoolEntry = {
    kind,
    el,
    originalSrc: src,
    gain: null,
    source: null,
    routedTrackId: null,
    ready: false,
    lastSeekAt: 0,
  };
  el.addEventListener(
    "loadeddata",
    () => {
      entry.ready = true;
    },
    { once: true },
  );
  // Suppress unhelpful "play() interrupted by pause()" console errors.
  el.addEventListener("error", () => {
    /* noop — surfaced via `ready === false` */
  });
  return entry;
}

/** Get (or create) a pool entry for a clip. Always returns the same instance. */
export function acquire(clipId: string, kind: PoolKind, src: string): PoolEntry {
  let entry = _entries.get(clipId);
  if (entry && entry.kind === kind && entry.originalSrc === src) return entry;
  if (entry) release(clipId); // src or kind changed — start over
  entry = makeEntry(kind, src);
  _entries.set(clipId, entry);
  return entry;
}

/**
 * Route this element through Web Audio so its volume can exceed 1.0.
 * If `trackId` is given, the gain is connected into that track's bus
 * (which itself is connected to the master). Otherwise it goes straight
 * to the master bus.
 */
export function attachAudio(entry: PoolEntry, trackId?: string): void {
  const ctx = audioCtx();
  const targetTrack = trackId ?? null;

  // Already routed correctly? Nothing to do.
  if (entry.gain && entry.source && entry.routedTrackId === targetTrack) return;

  // Routed to the wrong destination — re-route the existing gain instead of
  // recreating the source node (sources are one-per-element forever).
  if (entry.gain && entry.source) {
    try {
      entry.gain.disconnect();
    } catch {
      /* ignore */
    }
    const dest = targetTrack ? trackBus(targetTrack) : masterGain();
    entry.gain.connect(dest);
    entry.routedTrackId = targetTrack;
    return;
  }

  // First-time routing.
  if (entry.kind === "video") {
    entry.el.muted = false;
  }
  entry.source = getOrCreateSource(entry.el);
  entry.gain = ctx.createGain();
  const dest = targetTrack ? trackBus(targetTrack) : masterGain();
  entry.source.connect(entry.gain).connect(dest);
  entry.routedTrackId = targetTrack;
}

/** Detach audio routing (silences this element). */
export function detachAudio(entry: PoolEntry): void {
  if (!entry.gain) return;
  try {
    entry.gain.disconnect();
  } catch {
    /* ignore */
  }
  entry.gain = null;
  entry.routedTrackId = null;
  // Note: we do NOT discard `entry.source`. Per spec, a source node may only
  // be created once per element. Keep it; we'll reconnect a new gain on the
  // next attachAudio.
  if (entry.source) {
    try {
      entry.source.disconnect();
    } catch {
      /* ignore */
    }
  }
  if (entry.kind === "video") entry.el.muted = true;
}

/** Set instantaneous gain (volume). Honors values > 1.0. */
export function setGain(entry: PoolEntry, value: number): void {
  if (!entry.gain) return;
  const v = Math.max(0, value);
  entry.gain.gain.setTargetAtTime(v, audioCtx().currentTime, 0.005);
}

/** Schedule a linear gain ramp from `from` to `to` over `seconds`, starting now. */
export function rampGain(entry: PoolEntry, from: number, to: number, seconds: number): void {
  if (!entry.gain) return;
  const ctx = audioCtx();
  const g = entry.gain.gain;
  g.cancelScheduledValues(ctx.currentTime);
  g.setValueAtTime(Math.max(0, from), ctx.currentTime);
  g.linearRampToValueAtTime(Math.max(0, to), ctx.currentTime + Math.max(0.001, seconds));
}

/** Drop a clip from the pool, freeing its element + audio nodes. */
export function release(clipId: string): void {
  const e = _entries.get(clipId);
  if (!e) return;
  try {
    e.el.pause();
  } catch {
    /* ignore */
  }
  detachAudio(e);
  e.el.removeAttribute("src");
  try {
    e.el.load();
  } catch {
    /* ignore */
  }
  _entries.delete(clipId);
}

/** Purge any entries whose clipId is not in `keep`. */
export function reconcile(keep: Set<string>): void {
  for (const id of [..._entries.keys()]) {
    if (!keep.has(id)) release(id);
  }
}

export function get(clipId: string): PoolEntry | undefined {
  return _entries.get(clipId);
}

export function disposeAll(): void {
  for (const id of [..._entries.keys()]) release(id);
}
