"use client";

/**
 * Live recording → peaks pipeline.
 *
 * The peaks cache is the single source of truth for `WaveformCanvas`. We
 * pre-allocate a `PeakData` for the in-progress recording, register it under
 * a synthetic asset id, and append [min, max] pairs to its Float32Array as
 * analyser frames arrive. Bumping the clip's `duration` periodically (done
 * by the store) re-runs WaveformCanvas's effect and the new peaks become
 * visible.
 *
 * Resolution & texture
 * --------------------
 * The peak grid is 200 buckets/sec; the analyser fires at requestAnimationFrame
 * cadence (~60 Hz). At 48 kHz with a 4096-sample analyser buffer we have
 * ~85 ms of audio per frame to subdivide — plenty for the ~3-4 grid buckets
 * we need to fill per frame.
 *
 * Each frame we determine N = number of grid buckets that should have been
 * written by now (`floor(elapsed * 200) - lastBucket`), take the most
 * recent N × samplesPerBucket samples from the buffer (newest = right-most
 * end of the analyser window), and divide them into N non-overlapping
 * windows. Each window contributes its own `[min, max]` to one bucket.
 *
 * Result: per-bucket variation, not the flat plateaus you get from writing
 * the same extremum across every bucket in a frame. On stop, the file gets
 * re-decoded and full-resolution peaks recompute via `getPeaks`, replacing
 * the live peaks in the cache.
 */

import {
  PEAK_BUCKETS_PER_SECOND,
  clearPeaks,
  setCachedPeaks,
  type PeakData,
} from "@/lib/audio/peaks";
import { addMeterListener } from "./recorder";

/** Maximum duration we'll preallocate live peaks for. ~5.8 MB for 60 min. */
const MAX_LIVE_DURATION_S = 60 * 60;

type LiveSession = {
  assetId: string;
  data: PeakData;
  /** Highest grid bucket written so far. */
  lastBucket: number;
  /** Returns the recorder's current elapsed time in seconds. */
  getElapsed: () => number;
  unsubscribe: () => void;
};

let _session: LiveSession | null = null;

export function startLivePeaks(
  assetId: string,
  getElapsed: () => number,
): PeakData {
  // If a previous session leaked, tear it down first.
  stopLivePeaks();

  const totalBuckets = MAX_LIVE_DURATION_S * PEAK_BUCKETS_PER_SECOND;
  const buffer = new Float32Array(totalBuckets * 2); // [min, max] pairs
  const data: PeakData = {
    duration: 0,
    sampleRate: 48000,
    channels: 1,
    peaks: [buffer],
    bucketsPerSecond: PEAK_BUCKETS_PER_SECOND,
  };
  setCachedPeaks(assetId, data);

  const session: LiveSession = {
    assetId,
    data,
    lastBucket: -1,
    getElapsed,
    unsubscribe: () => {},
  };

  session.unsubscribe = addMeterListener(({ samples, sampleRate }) => {
    if (_session !== session) return;
    if (samples.length === 0 || sampleRate === 0) return;

    const bps = PEAK_BUCKETS_PER_SECOND;
    const samplesPerBucket = Math.max(1, Math.floor(sampleRate / bps));
    const elapsed = session.getElapsed();
    const targetBucket = Math.min(
      totalBuckets - 1,
      Math.floor(elapsed * bps),
    );
    const firstBucket = session.lastBucket + 1;
    const nNew = targetBucket - session.lastBucket;
    if (nNew <= 0) return;

    /* The analyser buffer holds the most recent `samples.length` PCM samples.
       We treat its tail (newest) as authoritative for the buckets we still
       owe; if we owe more buckets than fit in the buffer, the older buckets
       fall back to repeating the oldest available sub-window's extremum
       (ensures no zero-gap holes when rAF stalls). */
    const maxWindowed = Math.floor(samples.length / samplesPerBucket);
    const windowed = Math.min(nNew, maxWindowed);
    const tailStart = Math.max(0, samples.length - windowed * samplesPerBucket);

    for (let i = 0; i < windowed; i++) {
      const segStart = tailStart + i * samplesPerBucket;
      const segEnd = segStart + samplesPerBucket;
      let min = 0;
      let max = 0;
      for (let j = segStart; j < segEnd; j++) {
        const v = samples[j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const bucket = targetBucket - windowed + 1 + i;
      buffer[bucket * 2] = min;
      buffer[bucket * 2 + 1] = max;
    }

    /* Fill any older lagged buckets with the first sub-window's extremum so
       there are no visible zero-gaps. Only kicks in when rAF has been
       starved for >1 frame. */
    if (windowed < nNew) {
      const fillMin = buffer[(targetBucket - windowed + 1) * 2];
      const fillMax = buffer[(targetBucket - windowed + 1) * 2 + 1];
      for (let b = firstBucket; b < targetBucket - windowed + 1; b++) {
        buffer[b * 2] = fillMin;
        buffer[b * 2 + 1] = fillMax;
      }
    }

    session.lastBucket = targetBucket;
    session.data.duration = elapsed;
  });

  _session = session;
  return data;
}

/** Stop appending; leave the cached peaks in place. Caller decides cleanup. */
export function stopLivePeaks(): void {
  if (!_session) return;
  _session.unsubscribe();
  _session = null;
}

/** Stop and remove the cached peaks entirely (used on cancel). */
export function discardLivePeaks(): void {
  if (!_session) return;
  const id = _session.assetId;
  stopLivePeaks();
  clearPeaks(id);
}

export function liveRecordingAssetId(): string | null {
  return _session?.assetId ?? null;
}
