"use client";

/**
 * Single AudioContext for the whole editor.
 *
 * Two invariants this module guarantees:
 *  1. There is at most one AudioContext per page lifetime. Web Audio caps the
 *     number of contexts a tab can open and `createMediaElementSource` will
 *     throw if called twice on the same element, so we cannot afford accidental
 *     duplication (React Strict Mode double-invokes effects in dev).
 *  2. The context is resumed on the first user gesture (browsers start it
 *     `suspended` and silently drop sound until then).
 */

let _ctx: AudioContext | null = null;
let _resumed = false;

export function audioCtx(): AudioContext {
  if (_ctx) return _ctx;
  const Ctor =
    (typeof window !== "undefined" &&
      ((window.AudioContext as typeof AudioContext | undefined) ??
        ((window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext))) ||
    null;
  if (!Ctor) {
    throw new Error("Web Audio is not supported in this browser.");
  }
  _ctx = new Ctor();
  return _ctx;
}

export async function ensureRunning(): Promise<void> {
  const ctx = audioCtx();
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
      _resumed = true;
    } catch {
      /* ignore — will retry on next gesture */
    }
  } else {
    _resumed = true;
  }
}

export function isResumed(): boolean {
  return _resumed && audioCtx().state === "running";
}

/**
 * `createMediaElementSource` may only be called once per element. Cache the
 * resulting node so subsequent calls return the same one and we never crash.
 */
const _sourceCache = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

export function getOrCreateSource(el: HTMLMediaElement): MediaElementAudioSourceNode {
  const cached = _sourceCache.get(el);
  if (cached) return cached;
  const ctx = audioCtx();
  const node = ctx.createMediaElementSource(el);
  _sourceCache.set(el, node);
  return node;
}

/* ------------------------------------------------------------------------ */
/* Audio routing graph                                                       */
/*                                                                           */
/*   clip.gain  ─┐                                                           */
/*   clip.gain  ─┼─►  track[id].gain  ─►  master.gain  ─►  analyser  ─► out  */
/*   clip.gain  ─┘                                                           */
/*                                                                           */
/* Track buses are created on first read. The analyser is kept always-on so  */
/* the meter can sample peaks without latency on first play.                 */
/* ------------------------------------------------------------------------ */

let _master: GainNode | null = null;
let _analyser: AnalyserNode | null = null;

export function masterGain(): GainNode {
  if (_master) return _master;
  const ctx = audioCtx();
  _master = ctx.createGain();
  _analyser = ctx.createAnalyser();
  _analyser.fftSize = 1024;
  _analyser.smoothingTimeConstant = 0.4;
  _master.connect(_analyser);
  _analyser.connect(ctx.destination);
  return _master;
}

export function analyserNode(): AnalyserNode {
  masterGain();
  return _analyser!;
}

export function setMasterGain(value: number): void {
  const m = masterGain();
  m.gain.setTargetAtTime(Math.max(0, value), audioCtx().currentTime, 0.005);
}

/**
 * Per-track bus: clip.gain → bus.gain → bus.analyser → master.gain.
 * The analyser is *in series* (not a tap) so it sees the post-fader signal
 * exactly as it leaves the track — meaning the meter shows what the listener
 * hears, including the user's gain slider effect.
 */
type TrackBus = {
  gain: GainNode;
  analyser: AnalyserNode;
};

const _trackBuses = new Map<string, TrackBus>();

function getOrCreateTrackBus(trackId: string): TrackBus {
  let bus = _trackBuses.get(trackId);
  if (!bus) {
    const ctx = audioCtx();
    const gain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.4;
    gain.connect(analyser);
    analyser.connect(masterGain());
    bus = { gain, analyser };
    _trackBuses.set(trackId, bus);
  }
  return bus;
}

/** Public: the input gain node for a track. Clips connect their gain into this. */
export function trackBus(trackId: string): GainNode {
  return getOrCreateTrackBus(trackId).gain;
}

/** Public: the analyser sitting just after the track gain. Read for metering. */
export function trackAnalyser(trackId: string): AnalyserNode {
  return getOrCreateTrackBus(trackId).analyser;
}

export function setTrackGain(trackId: string, value: number): void {
  const bus = getOrCreateTrackBus(trackId);
  bus.gain.gain.setTargetAtTime(Math.max(0, value), audioCtx().currentTime, 0.005);
}

/** Drop a track bus when its track is removed. Disconnects all incoming clips. */
export function releaseTrackBus(trackId: string): void {
  const bus = _trackBuses.get(trackId);
  if (!bus) return;
  try {
    bus.gain.disconnect();
  } catch {
    /* ignore */
  }
  try {
    bus.analyser.disconnect();
  } catch {
    /* ignore */
  }
  _trackBuses.delete(trackId);
}
