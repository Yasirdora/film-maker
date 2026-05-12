"use client";

import { useSyncExternalStore } from "react";

/**
 * Master clock for editor playback.
 *
 * Time semantics
 * --------------
 * `time()` is project-time in seconds. While playing, time advances on each
 * animation frame as `playStartTime + (performance.now() - wallStart) / 1000`,
 * so a dropped frame doesn't accumulate drift the way a `time += dt` loop would.
 *
 * Subscription model
 * ------------------
 * Subscribers are notified on every play-frame, plus once on each pause / seek.
 * Components opt in via `useClockTime()` (a `useSyncExternalStore` hook).
 * Components that only need to know whether playback is happening (not the
 * exact time) should listen to `useEditor((s) => s.playing)` from Zustand
 * instead so they don't re-render at frame rate.
 *
 * Drift correction
 * ----------------
 * `syncTo(t)` lets a media element nudge the clock toward its own decoded
 * frame time (called from `requestVideoFrameCallback`). Small drifts are
 * absorbed into `playStartTime` so the playhead doesn't visibly snap; large
 * drifts (> 200 ms — caused by buffering / seeking) are honored hard.
 */

type Listener = () => void;

class EditorClock {
  private _time = 0;
  private _playing = false;
  private _wallStart = 0;
  private _playStartTime = 0;
  private _max = Number.POSITIVE_INFINITY;
  private _raf = 0;
  private _listeners = new Set<Listener>();
  /** Listeners that only care about play/pause transitions, not every tick. */
  private _playingListeners = new Set<Listener>();
  private _onEnd: (() => void) | null = null;
  private _loopEnabled = false;
  private _loopIn = 0;
  private _loopOut = 0;

  // ---- read API ---------------------------------------------------------

  time = (): number => this._time;
  playing = (): boolean => this._playing;
  max = (): number => this._max;

  // ---- mutators ---------------------------------------------------------

  setMax(max: number): void {
    this._max = Math.max(0, max);
    if (this._time > this._max) this.seek(this._max);
  }

  setLoop(enabled: boolean, loopIn: number, loopOut: number): void {
    this._loopEnabled = enabled;
    this._loopIn = loopIn;
    this._loopOut = loopOut;
  }

  setOnEnd(cb: (() => void) | null): void {
    this._onEnd = cb;
  }

  play(): void {
    if (this._playing) return;
    if (this._time >= this._max) this._time = 0;
    this._playing = true;
    this._wallStart = performance.now();
    this._playStartTime = this._time;
    this._raf = requestAnimationFrame(this._tick);
    this._notify();
    this._notifyPlaying();
  }

  pause(): void {
    if (!this._playing) return;
    this._playing = false;
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._notify();
    this._notifyPlaying();
  }

  toggle(): void {
    if (this._playing) this.pause();
    else this.play();
  }

  seek(t: number): void {
    const clamped = Math.max(0, Math.min(this._max, t));
    this._time = clamped;
    if (this._playing) {
      this._wallStart = performance.now();
      this._playStartTime = clamped;
    }
    this._notify();
  }

  /**
   * Called by the leading video element via requestVideoFrameCallback to keep
   * the clock anchored to actual decoded frames. No-op when paused.
   */
  syncTo(projectTime: number): void {
    if (!this._playing) return;
    const drift = projectTime - this._time;
    const abs = Math.abs(drift);
    if (abs > 0.25) {
      // Hard snap (after a buffer stall or a seek).
      this._time = projectTime;
      this._wallStart = performance.now();
      this._playStartTime = projectTime;
      this._notify();
    } else if (abs > 0.015) {
      // Smooth pull: nudge `playStartTime` so future ticks converge.
      this._playStartTime += drift * 0.2;
    }
  }

  // ---- subscription -----------------------------------------------------

  subscribe = (cb: Listener): (() => void) => {
    this._listeners.add(cb);
    return () => {
      this._listeners.delete(cb);
    };
  };

  /** Subscribe only to play/pause transitions (not every tick). */
  subscribePlaying = (cb: Listener): (() => void) => {
    this._playingListeners.add(cb);
    return () => {
      this._playingListeners.delete(cb);
    };
  };

  /**
   * useSyncExternalStore needs `getSnapshot` to be referentially stable AND
   * to return a primitive that React can compare with `Object.is`. Numbers
   * are compared by value, so returning `_time` re-renders only when it
   * actually changes.
   */
  getTimeSnapshot = (): number => this._time;
  getPlayingSnapshot = (): boolean => this._playing;

  // ---- internal ---------------------------------------------------------

  private _tick = (): void => {
    if (!this._playing) return;
    const now = performance.now();
    let t = this._playStartTime + (now - this._wallStart) / 1000;
    if (this._loopEnabled && this._loopIn < this._loopOut && t >= this._loopOut) {
      this._time = this._loopIn;
      this._wallStart = now;
      this._playStartTime = this._loopIn;
      this._notify();
      this._raf = requestAnimationFrame(this._tick);
      return;
    }
    if (t >= this._max) {
      t = this._max;
      this._time = t;
      this._playing = false;
      this._raf = 0;
      this._notify();
      this._notifyPlaying();
      this._onEnd?.();
      return;
    }
    this._time = t;
    this._notify();
    this._raf = requestAnimationFrame(this._tick);
  };

  private _notify(): void {
    for (const l of this._listeners) l();
  }

  private _notifyPlaying(): void {
    for (const l of this._playingListeners) l();
  }
}

export const clock = new EditorClock();

/** Subscribe a component to project time. Re-renders at frame rate while playing. */
export function useClockTime(): number {
  return useSyncExternalStore(clock.subscribe, clock.getTimeSnapshot, clock.getTimeSnapshot);
}

/** Subscribe a component to play/pause state only. Re-renders only on play/pause transitions, NOT every tick. */
export function useClockPlaying(): boolean {
  return useSyncExternalStore(clock.subscribePlaying, clock.getPlayingSnapshot, clock.getPlayingSnapshot);
}

/** Snap a project-time value to the nearest frame for a given fps. */
export function quantizeToFrame(t: number, fps: number): number {
  if (fps <= 0) return t;
  return Math.round(t * fps) / fps;
}
