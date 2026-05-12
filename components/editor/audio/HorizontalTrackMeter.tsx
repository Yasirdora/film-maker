"use client";

import { useEffect, useRef } from "react";
import { trackAnalyser } from "@/lib/editor/audio";

/**
 * Horizontal level meter — a continuous green→yellow→red gradient bar
 * that fills from the left up to the current RMS level. The unfilled
 * region shows a dim ghost of the same gradient so the bar always
 * reads as a meter, even at rest. A 1 px white peak-hold tick rides
 * on top of the fill (800 ms hold, then linear decay). At 0 dBFS
 * (the right edge), a faint clip indicator lights when peaks ≥ 0.99.
 */
export default function HorizontalTrackMeter({
  trackId,
  height = 5,
}: {
  trackId: string;
  height?: number;
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
    let lastW = 0;

    function configure(): { ctx: CanvasRenderingContext2D; w: number } | null {
      const c = ref.current;
      if (!c) return null;
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      const cssW = c.clientWidth || c.parentElement?.clientWidth || 200;
      if (cssW !== lastW) {
        c.width = Math.max(1, Math.floor(cssW * dpr));
        c.height = Math.max(1, Math.floor(height * dpr));
        c.style.height = `${height}px`;
        lastW = cssW;
      }
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx, w: cssW };
    }

    function draw() {
      const setup = configure();
      if (!setup) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const { ctx, w } = setup;
      const h = height;

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
  }, [trackId, height]);

  return (
    <canvas
      ref={ref}
      aria-label="Track level"
      style={{
        display: "block",
        width: "100%",
        height,
        borderRadius: Math.min(2, height / 2),
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

function buildGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  alpha: number,
): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  const a = (hex: string) => withAlpha(hex, alpha);
  g.addColorStop(0, a("#32d74b"));
  g.addColorStop(0.55, a("#a8e000"));
  g.addColorStop(0.78, a("#ffd60a"));
  g.addColorStop(0.92, a("#ff9500"));
  g.addColorStop(1, a("#ff3b30"));
  return g;
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

  /* Substrate — dark base so the bar always reads as an inset trough */
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(0, 0, w, h);



  /* Lit fill — full-saturation gradient up to current RMS */
  const fillW = toMeter(rms) * w;
  if (fillW > 0) {
    ctx.fillStyle = buildGradient(ctx, w, 1);
    ctx.fillRect(0, 0, fillW, h);
  }

  /* Peak-hold tick — 1 px white line at the current peak position */
  const peakX = toMeter(peak) * w;
  if (peakX > 0.5) {
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(Math.min(w - 1, peakX - 0.5), 0, 1, h);
  }

  /* Subtle hairline border so the bar separates cleanly from the
     surrounding panel. */
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}
