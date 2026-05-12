import { EnvelopePoint } from "./types";

/**
 * Linearly interpolates the volume value at a specific local clip time
 * based on the provided automation envelope points.
 * 
 * If there are no points, returns 1.0 (native volume).
 * If the time is before the first point, returns the first point's value.
 * If the time is after the last point, returns the last point's value.
 */
export function interpolateEnvelope(points: EnvelopePoint[], time: number): number {
  if (!points || points.length === 0) return 1.0;
  if (points.length === 1) return points[0].value;

  // Assume points are sorted by time. If not, they should be sorted when mutated.
  // Find the segment the current time falls into.
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    if (time >= p1.time && time <= p2.time) {
      // Linear interpolation between p1 and p2
      const tDiff = p2.time - p1.time;
      if (tDiff === 0) return p2.value; // Avoid division by zero
      
      const factor = (time - p1.time) / tDiff;
      return p1.value + (p2.value - p1.value) * factor;
    }
  }

  // If time is before the first point
  if (time < points[0].time) return points[0].value;

  // If time is after the last point
  return points[points.length - 1].value;
}
