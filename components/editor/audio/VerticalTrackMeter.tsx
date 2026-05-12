"use client";

import { useEffect, useRef } from "react";
import { trackAnalyser } from "@/lib/editor/audio";

/**
 * Vertical level meter — segmented bar (similar to the screenshot)
 * from green to red.
 */
export default function VerticalTrackMeter({
  trackId,
  width = 8,
}: {
  trackId: string;
  width?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let raf = 0;
    let buf: Float32Array<ArrayBuffer> | null = null;
    let smoothed = 0;
    let peakHold = 0;
    let peakHoldUntil = 0;
    let lastH = 0;

    function configure(): { ctx: CanvasRenderingContext2D; h: number } | null {
      const c = ref.current;
      if (!c) return null;
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      const cssH = c.clientHeight || c.parentElement?.clientHeight || 100;
      if (cssH !== lastH) {
        c.width = Math.max(1, Math.floor(width * dpr));
        c.height = Math.max(1, Math.floor(cssH * dpr));
        c.style.width = `${width}px`;
        lastH = cssH;
      }
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx, h: cssH };
    }

    function draw() {
      const setup = configure();
      if (!setup) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const { ctx, h } = setup;
      const w = width;

      const an = trackAnalyser(trackId);
      if (!buf || buf.length !== an.fftSize) {
        buf = new Float32Array(
          new ArrayBuffer(an.fftSize * Float32Array.BYTES_PER_ELEMENT),
        );
      }
      an.getFloatTimeDomainData(buf);

      let sumSq = 0;
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i];
        sumSq += v * v;
        const a = v < 0 ? -v : v;
        if (a > peak) peak = a;
      }
      const rms = Math.sqrt(sumSq / buf.length);
      smoothed = smoothed * 0.5 + rms * 0.5;

      const now = performance.now();
      if (peak >= peakHold || now > peakHoldUntil) {
        peakHold = peak;
        peakHoldUntil = now + 800;
      } else {
        const elapsed = (now - (peakHoldUntil - 800)) / 1000;
        // Faster decay: 0.2 units per second (5s full range)
        peakHold = Math.max(peak, peakHold - elapsed * 0.2);
      }

      drawBar(ctx, w, h, smoothed, peakHold);
      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [trackId, width]);

  return (
    <canvas
      ref={ref}
      aria-label="Track level"
      style={{
        display: "block",
        height: "100%",
        width,
        borderRadius: Math.min(2, width / 2),
      }}
    />
  );
}

/* Map linear amplitude to a 0..1 meter position on a -60..0 dB scale. */
function toMeter(amp: number): number {
  if (amp < 0.001) return 0; // -60dB threshold
  const db = 20 * Math.log10(amp);
  return Math.max(0, Math.min(1, (db + 60) / 60));
}

function getColor(ratio: number, alpha: number = 1): string {
  // ratio goes from 0 (bottom) to 1 (top)
  const a = (hex: string) => withAlpha(hex, alpha);
  if (ratio > 0.92) return a("#ff3b30");
  if (ratio > 0.78) return a("#ff9500");
  if (ratio > 0.55) return a("#ffd60a");
  if (ratio > 0.1) return a("#a8e000");
  return a("#32d74b");
}

function withAlpha(hex: string, alpha: number): string {
  const v = parseInt(hex.slice(1), 16);
  const r = (v >> 16) & 0xff;
  const gr = (v >> 8) & 0xff;
  const b = v & 0xff;
  return `rgba(${r},${gr},${b},${alpha})`;
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rms: number,
  peak: number,
): void {
  ctx.clearRect(0, 0, w, h);

  // Background trough
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(0, 0, w, h);

  const fillH = toMeter(rms) * h;
  const peakH = toMeter(peak) * h;
  
  // Segment size
  const segmentH = 2;
  const gap = 1;
  const step = segmentH + gap;

  // Draw segments from bottom to top
  for (let y = h - segmentH; y >= 0; y -= step) {
    const segmentBottom = h - y;
    const ratio = segmentBottom / h;
    
    // Check if lit
    const isLit = fillH > 0 && segmentBottom <= fillH;
    const isPeak = peakH > 0 && Math.abs(segmentBottom - peakH) <= step;

    if (isLit || isPeak) {
      ctx.fillStyle = getColor(ratio, 1);
      ctx.fillRect(0, y, w, segmentH);
    }
  }

  // Border
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}
