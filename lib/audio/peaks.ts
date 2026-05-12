"use client";

import { useEffect, useState } from "react";
import { audioCtx } from "../editor/audio";

/**
 * Per-asset audio peak data, computed once and cached for the page lifetime.
 *
 * Encoding
 * --------
 * For each channel: a Float32Array containing alternating min/max samples,
 * one pair per "bucket". A bucket spans `1 / bucketsPerSecond` seconds of
 * source audio. We pick 200 buckets/sec (≈5 ms per pixel at our default
 * 60 px/s zoom) — fine enough that even at 4× zoom-in, each pixel covers
 * ~1.25 ms of source, which is well below human transient resolution.
 *
 * Memory: a 5-minute mono track = 5 * 60 * 200 * 2 floats = 120 000 * 4 B
 * = ~480 KB. Stereo doubles that. Acceptable for any reasonable session.
 */

export type PeakData = {
  duration: number;
  sampleRate: number;
  channels: number;
  peaks: Float32Array[]; // one Float32Array per channel
  bucketsPerSecond: number;
};

const BUCKETS_PER_SECOND = 200;

function computePeaks(audioBuffer: AudioBuffer): PeakData {
  const { sampleRate, duration, numberOfChannels } = audioBuffer;
  const totalBuckets = Math.max(1, Math.ceil(duration * BUCKETS_PER_SECOND));
  const samplesPerBucket = Math.max(1, Math.floor(sampleRate / BUCKETS_PER_SECOND));

  const peaks: Float32Array[] = [];
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    const arr = new Float32Array(totalBuckets * 2);
    for (let b = 0; b < totalBuckets; b++) {
      const start = b * samplesPerBucket;
      const end = Math.min(start + samplesPerBucket, data.length);
      let min = 0;
      let max = 0;
      for (let i = start; i < end; i++) {
        const s = data[i];
        if (s < min) min = s;
        if (s > max) max = s;
      }
      arr[b * 2] = min;
      arr[b * 2 + 1] = max;
    }
    peaks.push(arr);
  }

  return {
    duration,
    sampleRate,
    channels: numberOfChannels,
    peaks,
    bucketsPerSecond: BUCKETS_PER_SECOND,
  };
}

const _cache = new Map<string, PeakData>();
const _inflight = new Map<string, Promise<PeakData>>();

export async function getPeaks(assetId: string, url: string): Promise<PeakData> {
  const cached = _cache.get(assetId);
  if (cached) return cached;
  const pending = _inflight.get(assetId);
  if (pending) return pending;

  const p = (async (): Promise<PeakData> => {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    // decodeAudioData mutates the input on some browsers — use a copy.
    const copy = buf.slice(0);
    const audioBuffer = await audioCtx().decodeAudioData(copy);
    return computePeaks(audioBuffer);
  })();

  _inflight.set(assetId, p);
  try {
    const data = await p;
    _cache.set(assetId, data);
    return data;
  } finally {
    _inflight.delete(assetId);
  }
}

export function clearPeaks(assetId?: string): void {
  if (!assetId) {
    _cache.clear();
    return;
  }
  _cache.delete(assetId);
}

/**
 * Replace (or insert) a cached peak entry for an asset. Used by the live
 * recording pipeline so the same WaveformCanvas pipeline that renders
 * finalized clips can render the take as it's being captured. Mutating the
 * returned `peaks[ch]` Float32Array in place is safe and will be visible to
 * any consumer that re-reads the cache.
 */
export function setCachedPeaks(assetId: string, data: PeakData): void {
  _cache.set(assetId, data);
}

export const PEAK_BUCKETS_PER_SECOND = BUCKETS_PER_SECOND;

/** Hook that fetches and returns peaks for an asset (null while loading). */
export function usePeaks(
  assetId: string | undefined,
  url: string | undefined,
): PeakData | null {
  const [data, setData] = useState<PeakData | null>(() =>
    assetId ? _cache.get(assetId) ?? null : null,
  );

  useEffect(() => {
    // Reset state and (asynchronously) fetch peaks when the source asset
    // changes. The lint rule flags these synchronous setData calls but
    // this is the canonical "subscribe to derived async data" pattern —
    // the cached/null transition has to surface to the renderer.
    if (!assetId || !url) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      return;
    }
    const cached = _cache.get(assetId);
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(cached);
      return;
    }
    let cancelled = false;
    getPeaks(assetId, url)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) console.error("getPeaks failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, url]);

  return data;
}
