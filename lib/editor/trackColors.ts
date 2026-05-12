/**
 * Track color palette — the seven swatches shown in the track kebab menu's
 * "Change Color" picker. Hex format so it's CSS-ready everywhere; convert
 * to "r, g, b" via {@link hexToRgbTriplet} where the consumer needs it
 * (e.g. translucent fills via `rgba(${triplet}, 0.2)`).
 */
/**
 * Adobe Premiere Pro inspired track colors — calibrated for distinct, professional
 * labeling on dark surfaces.
 */
export const TRACK_COLORS = [
  "#3AA0E5", // Cerulean
  "#48B06B", // Forest
  "#EB6A71", // Rose
  "#F49451", // Mango
  "#A58CE4", // Lavender
  "#7A78EC", // Iris
  "#17B3A3", // Caribbean
] as const;

export type TrackColor = (typeof TRACK_COLORS)[number];

/** Pick a default color for the Nth audio track. Cycles through the palette. */
export function defaultTrackColor(index: number): string {
  return TRACK_COLORS[index % TRACK_COLORS.length];
}

/** Convert "#22c55e" → "34, 197, 94" so callers can build rgba(...) strings. */
export function hexToRgbTriplet(hex: string): string {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  const v = parseInt(
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean,
    16,
  );
  if (Number.isNaN(v)) return "255, 255, 255";
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  return `${r}, ${g}, ${b}`;
}
