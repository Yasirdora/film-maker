"use client";

import { clock } from "./clock";
import * as pool from "./mediaPool";
import type { Clip, EditorState, MediaAsset, Track } from "./types";
import { interpolateEnvelope } from "./envelope";

/**
 * Sits between the master clock and the per-clip media elements.
 *
 * Responsibility: translate (timeline state, current time, playing flag) into
 * the smallest set of element commands needed — without calling `play()` /
 * `currentTime =` on every frame.
 *
 * Cut-point smoothness
 * --------------------
 * The critical insight for glitch-free cuts: when the playhead is about to
 * leave clip A and enter clip B, clip B's video element must already be:
 *   1. Created and loaded (`readyState >= HAVE_CURRENT_DATA`)
 *   2. Seeked to its in-point so the first frame is decoded
 *   3. Paused and waiting — `play()` then starts instantly
 *
 * We achieve this with a **look-ahead pre-buffer**: on every tick, we scan
 * for clips that will become active within the next `PREBUFFER_S` seconds
 * and eagerly acquire + seek their pool entries. By the time the playhead
 * actually reaches them, the browser has already decoded the keyframe and
 * the transition is seamless.
 *
 * State machine
 * -------------
 * For each clip we track a single `commanded` flag: did we last tell its
 * element to be playing (or, if paused, to be at a particular time)?
 *
 *   • Active set diff at each tick:
 *       — clips that just became active → seek + play (or just seek if paused)
 *       — clips that just became inactive → pause
 *       — clips that are still active → only nudge if drift > NUDGE_THRESHOLD
 *
 *   • Volume / fades are applied only on transitions.
 *
 * Lifecycle: call `update(state)` whenever the clock ticks or the project
 * graph changes. Call `dispose()` on unmount.
 */

const NUDGE_THRESHOLD_S = 0.15; // forgiving — video decode latency is ~50-80ms; too tight triggers constant seeking
const SEEK_RATE_LIMIT_MS = 50;  // minimum gap between seeks — prevents seek storms that stall the decoder
const PREBUFFER_S = 1.5;        // look-ahead window for pre-seeking upcoming clips

type CommandedState = {
  clipId: string;
  playing: boolean;
};

export type ProjectSnapshot = Pick<EditorState, "assets" | "clips" | "clipOrder" | "tracks">;

export class MediaController {
  private _commanded = new Map<string, CommandedState>();
  /**
   * Clips for which we have already attached a one-shot `loadeddata`
   * listener that will re-trigger `_onTick` once the element has data.
   * Without this, a clip that becomes "wanted" before its element finishes
   * loading is stuck at frame 0 forever — the clock only ticks on play /
   * seek / pause, so there's no second chance to issue the seek.
   */
  private _pendingReady = new Set<string>();
  /** Clips we've already pre-seeked (so we don't re-seek every tick). */
  private _preBuffered = new Set<string>();
  private _unsub: (() => void) | null = null;
  private _snapshot: ProjectSnapshot | null = null;

  /** Begin reacting to clock ticks. */
  start(): void {
    if (this._unsub) return;
    this._unsub = clock.subscribe(this._onTick);
  }

  /** Stop reacting to clock ticks. */
  stop(): void {
    if (this._unsub) {
      this._unsub();
      this._unsub = null;
    }
  }

  /** Project state changed (clip added / moved / inspector edited). */
  setSnapshot(snap: ProjectSnapshot): void {
    this._snapshot = snap;
    this._reconcilePool();
    // Eagerly preload all clips on the timeline (not just active ones).
    this._preloadAll();
    // Fire one update so newly-added clips get commanded immediately.
    this._onTick();
  }

  dispose(): void {
    this.stop();
    pool.disposeAll();
    this._commanded.clear();
    this._pendingReady.clear();
    this._preBuffered.clear();
    this._snapshot = null;
  }

  // ---- internals --------------------------------------------------------

  private _reconcilePool(): void {
    if (!this._snapshot) return;
    const keep = new Set<string>();
    for (const id of this._snapshot.clipOrder) {
      const c = this._snapshot.clips[id];
      if (!c) continue;
      if (c.kind === "video" || c.kind === "audio") keep.add(c.id);
    }
    pool.reconcile(keep);
    // Drop commanded entries for clips that no longer exist.
    for (const id of [...this._commanded.keys()]) {
      if (!keep.has(id)) this._commanded.delete(id);
    }
    for (const id of [...this._pendingReady]) {
      if (!keep.has(id)) this._pendingReady.delete(id);
    }
    for (const id of [...this._preBuffered]) {
      if (!keep.has(id)) this._preBuffered.delete(id);
    }
  }

  /**
   * Eagerly create pool entries for ALL media clips on the timeline.
   * This means their video/audio elements start loading immediately when
   * files are added, not when the playhead first reaches them.
   */
  private _preloadAll(): void {
    if (!this._snapshot) return;
    const snap = this._snapshot;
    for (const id of snap.clipOrder) {
      const c = snap.clips[id];
      if (!c) continue;
      if (c.kind !== "video" && c.kind !== "audio") continue;
      // Disabled clips are bypassed during playback; no need to preload.
      // This also protects against in-progress recording clips whose asset
      // url is still empty.
      if (c.disabled) continue;
      const asset = snap.assets[c.assetId];
      if (!asset || !asset.url) continue;
      // acquire creates the element and starts loading if it doesn't exist yet
      pool.acquire(c.id, c.kind, asset.url);
    }
  }

  /**
   * Pre-buffer clips that will become active within the look-ahead window.
   * For each, we seek their element to the correct in-point so the browser
   * decodes the first frame ahead of time. The clip is then "warm" and
   * play() will start instantly.
   *
   * NOTE: we deliberately do NOT start play() on upcoming clips. Starting
   * playback causes the element to advance past its in-point, so when the
   * clip becomes active, the controller would force-seek it backward —
   * stalling the decoder and producing a visible glitch. Pre-seeking to
   * the correct keyframe and leaving the element paused gives the browser
   * enough to decode the first frame without the backward-seek penalty.
   */
  private _preBufferUpcoming(time: number, playing: boolean): void {
    if (!this._snapshot || !playing) return;
    const snap = this._snapshot;
    const horizon = time + PREBUFFER_S;

    for (const id of snap.clipOrder) {
      const c = snap.clips[id];
      if (!c) continue;
      if (c.kind !== "video" && c.kind !== "audio") continue;

      // Only pre-buffer clips that START within the look-ahead window
      // and are not yet active (not currently in range).
      const startsInWindow = c.start > time && c.start <= horizon;
      if (!startsInWindow) continue;

      // Already pre-buffered at the right position? Skip.
      if (this._preBuffered.has(c.id)) continue;

      const asset = snap.assets[c.assetId];
      if (!asset) continue;

      const entry = pool.acquire(c.id, c.kind, asset.url);
      if (!entry.ready) {
        // Not loaded yet — arm a retry so once it loads, we pre-seek it.
        this._armReadyRetry(c.id, entry);
        continue;
      }

      // Pre-seek to the exact in-point so the first frame is decoded.
      const speed = clamp(c.speed || 1, 0.25, 4);
      const targetT = c.inPoint;
      const dur = entry.el.duration;
      const clamped = Math.max(0, isFinite(dur) ? Math.min(dur, targetT) : targetT);

      try {
        entry.el.currentTime = clamped;
        entry.el.playbackRate = speed;
        entry.lastSeekAt = performance.now();
      } catch {
        /* element not ready */
      }
      this._preBuffered.add(c.id);
    }
  }

  private _onTick = (): void => {
    if (!this._snapshot) return;
    const time = clock.time();
    const playing = clock.playing();
    const snap = this._snapshot;

    const trackById = new Map<string, Track>(snap.tracks.map((t) => [t.id, t]));
    const hasSoloed = snap.tracks.some((t) => t.soloed);
    const wantedAudible = new Set<string>();
    const wantedVisible = new Set<string>();

    for (const id of snap.clipOrder) {
      const c = snap.clips[id];
      if (!c) continue;
      if (!(c.kind === "video" || c.kind === "audio")) continue;
      if (c.disabled) continue; // Bypassed — skip entirely.
      const tr = trackById.get(c.trackId);
      if (!tr) continue;
      const inRange = time >= c.start && time < c.start + c.duration;
      if (!inRange) continue;
      if (c.kind === "video" && !tr.hidden) wantedVisible.add(c.id);
      const effectivelyMuted = tr.muted || (hasSoloed && !tr.soloed);
      if (!effectivelyMuted) wantedAudible.add(c.id);
    }

    // 1. Pause clips that fell out of the active set.
    for (const [id, state] of this._commanded) {
      if (!wantedAudible.has(id) && !wantedVisible.has(id)) {
        const e = pool.get(id);
        if (e && state.playing) {
          try {
            e.el.pause();
          } catch {
            /* ignore */
          }
        }
        this._commanded.delete(id);
      }
    }

    // 2. Drive each active clip.
    for (const id of new Set([...wantedAudible, ...wantedVisible])) {
      const c = snap.clips[id];
      if (!c) continue;
      // Only video/audio clips are pool-managed (text/image have no media element).
      if (c.kind !== "video" && c.kind !== "audio") continue;
      const asset = snap.assets[c.assetId];
      if (!asset) continue;
      const poolKind: "video" | "audio" = c.kind;
      const entry = pool.acquire(c.id, poolKind, asset.url);
      if (!entry.ready) {
        this._armReadyRetry(c.id, entry);
        continue;
      }

      // This clip is now active — clear its pre-buffer flag so it can be
      // pre-buffered again if it becomes upcoming in the future (e.g. loop).
      this._preBuffered.delete(c.id);

      const speed = clamp(c.speed || 1, 0.25, 4);
      const localT = c.inPoint + (time - c.start) * speed;
      const elT = entry.el.currentTime;

      const audible = wantedAudible.has(id);

      // Audio routing — connect to this clip's track bus (or re-route if the
      // clip moved to a different track). When the clip becomes inaudible
      // (track muted, out of range), detach so it stops sending sound.
      if (audible) {
        pool.attachAudio(entry, c.trackId);
        /* Apply fade envelope on top of the clip's base volume. */
        const posInClip = time - c.start;
        const baseVol = c.volume ?? 1;
        let fadeGain = 1;
        if (c.volumePoints && c.volumePoints.length > 0) {
          fadeGain = interpolateEnvelope(c.volumePoints, posInClip);
        } else {
          if (c.fadeIn > 0.001 && posInClip < c.fadeIn) {
            fadeGain = Math.min(1, posInClip / c.fadeIn);
          }
          if (c.fadeOut > 0.001 && posInClip > c.duration - c.fadeOut) {
            fadeGain = Math.min(fadeGain, Math.max(0, (c.duration - posInClip) / c.fadeOut));
          }
        }
        pool.setGain(entry, baseVol * fadeGain);
      } else if (entry.gain) {
        pool.detachAudio(entry);
      }

      // Speed.
      if (Math.abs(entry.el.playbackRate - speed) > 0.001) {
        entry.el.playbackRate = speed;
      }

      const cmd = this._commanded.get(id);
      const wantPlaying = playing;

      if (wantPlaying) {
        // Ensure playing.
        if (!cmd || !cmd.playing) {
          // Clip just became active — force-seek without rate limiting so the
          // first frame is correct immediately. This is the critical path for
          // smooth cuts.
          if (Math.abs(elT - localT) > 0.02) {
            this._forceSeek(entry, localT);
          }
          this._safePlay(entry);
          this._commanded.set(id, { clipId: id, playing: true });
        } else if (Math.abs(elT - localT) > NUDGE_THRESHOLD_S) {
          this._safeSeek(entry, localT);
        }
      } else {
        // Paused: just keep currentTime in sync if drifted.
        if (cmd?.playing) {
          try {
            entry.el.pause();
          } catch {
            /* ignore */
          }
        }
        if (Math.abs(elT - localT) > 0.05) this._safeSeek(entry, localT);
        this._commanded.set(id, { clipId: id, playing: false });
      }
    }

    // 3. Pre-buffer upcoming clips so cuts are seamless.
    this._preBufferUpcoming(time, playing);
  };

  /**
   * Attach a one-shot `loadeddata` listener that re-runs `_onTick` once the
   * element is paintable. Only one listener per clip is installed; subsequent
   * ticks while loading are no-ops. The pool's own `loadeddata` handler
   * always runs first (it was added at construction time), so by the time our
   * callback fires, `entry.ready` is already true.
   */
  private _armReadyRetry(clipId: string, entry: pool.PoolEntry): void {
    if (this._pendingReady.has(clipId)) return;
    this._pendingReady.add(clipId);
    const onReady = (): void => {
      this._pendingReady.delete(clipId);
      entry.el.removeEventListener("loadeddata", onReady);
      this._onTick();
    };
    entry.el.addEventListener("loadeddata", onReady);
    // Race guard: data may have arrived between the `!entry.ready` check
    // above and the listener attaching here.
    if (entry.ready) onReady();
  }

  private _safeSeek(entry: pool.PoolEntry, t: number): void {
    const now = performance.now();
    if (now - entry.lastSeekAt < SEEK_RATE_LIMIT_MS) return;
    this._forceSeek(entry, t);
  }

  /** Seek without rate limiting — used at cut points where latency matters. */
  private _forceSeek(entry: pool.PoolEntry, t: number): void {
    const dur = entry.el.duration;
    const clamped = Math.max(0, isFinite(dur) ? Math.min(dur, t) : t);
    try {
      entry.el.currentTime = clamped;
      entry.lastSeekAt = performance.now();
    } catch {
      /* element not ready */
    }
  }

  private _safePlay(entry: pool.PoolEntry): void {
    const p = entry.el.play();
    if (p && typeof p.then === "function") {
      p.catch(() => {
        /* AbortError when paused mid-flight — benign */
      });
    }
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Singleton — there is one media controller per editor session. */
export const mediaController = new MediaController();

/**
 * Compute the project's leading visible video clip at `t` — the topmost,
 * earliest-starting one. Used by PreviewStage to nominate a frame source for
 * `requestVideoFrameCallback`-based clock anchoring.
 */
export function leadingVideoClipId(snap: ProjectSnapshot, t: number): string | null {
  const trackOrder = new Map<string, number>();
  snap.tracks.forEach((tr, i) => trackOrder.set(tr.id, i));
  let best: { id: string; trackIdx: number; start: number } | null = null;
  for (const id of snap.clipOrder) {
    const c = snap.clips[id];
    if (!c || c.kind !== "video") continue;
    if (!(t >= c.start && t < c.start + c.duration)) continue;
    const idx = trackOrder.get(c.trackId) ?? 0;
    if (
      !best ||
      idx > best.trackIdx ||
      (idx === best.trackIdx && c.start < best.start)
    ) {
      best = { id: c.id, trackIdx: idx, start: c.start };
    }
  }
  return best?.id ?? null;
}
