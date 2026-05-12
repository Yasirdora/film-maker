export type ClipKind = "video" | "audio" | "image" | "text";

export type MediaAsset = {
  id: string;
  name: string;
  kind: "video" | "audio" | "image";
  // Object-URL for the original blob (browser-local).
  url: string;
  // Native duration in seconds (videos / audio); 0 for images.
  duration: number;
  // Native pixel size for video/image; 0 for audio.
  width: number;
  height: number;
  // Bytes (for display).
  size: number;
  mime: string;
  // Cached static thumbnail data-url (single frame for video, the image itself for images).
  thumbnail?: string;
  /** Origin of the asset. "recording" tags assets captured live in-app; the
   *  audio editor uses this to render the resulting clips in red. */
  source?: "recording";
};

export type Transform = {
  x: number; // canvas-space center x
  y: number; // canvas-space center y
  scale: number; // 1.0 = native
  rotation: number; // degrees
  opacity: number; // 0..1
  flipX: boolean;
  flipY: boolean;
};

export type TextStyle = {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  bgColor: string | null;
  align: "left" | "center" | "right";
  padding: number;
};

export type EnvelopePoint = {
  time: number; // seconds relative to the start of the clip
  value: number; // volume multiplier (e.g. 1.0 = native, 0.0 = silent, 2.0 = +6dB)
};

export type BaseClip = {
  id: string;
  trackId: string;
  // Position on the timeline (project seconds).
  start: number;
  duration: number;
  // For media-backed clips, where in the source we start from.
  inPoint: number;
  // Visual / audio modifiers applicable to all clips.
  speed: number; // 1 = native
  volume: number; // 0..2 (200%)
  volumePoints?: EnvelopePoint[]; // Optional automation curve (overrides base volume / fades)
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  /** When true the clip is bypassed — skipped during playback, dimmed in the UI. */
  disabled: boolean;
  /** When true, the clip is actively being processed by a background worker (e.g. FFmpeg) */
  isProcessing?: boolean;
  /** Hex color for the clip body. Seeded from the host track at creation time
   *  but persists per-clip — moving across tracks does not repaint it. The
   *  recorder asset and the muted state still override at render time. */
  color: string;
};

export type MediaClip = BaseClip & {
  kind: "video" | "audio" | "image";
  assetId: string;
  // Visual transform — only used for video/image clips.
  transform: Transform;
};

export type TextClip = BaseClip & {
  kind: "text";
  style: TextStyle;
  transform: Transform;
};

export type Clip = MediaClip | TextClip;

export type Track = {
  id: string;
  // Stack order: higher index renders on top in the preview.
  kind: "video" | "audio" | "text";
  muted: boolean;
  soloed: boolean;
  locked: boolean;
  hidden: boolean;
  collapsed: boolean;
  // User-supplied display name. Falls back to `Track N` when empty.
  name: string;
  // Hex color (e.g. "#22c55e"). Used for the clip body tint and the
  // colored accents in the track header. One of TRACK_COLORS by default.
  color: string;
  volume: number;
};

export type CanvasSettings = {
  width: number;
  height: number;
  background: string; // hex
  fps: number;
};

export type GapSelection = {
  trackId: string;
  start: number;
  end: number;
};

export type ToolId =
  | "files"
  | "media"
  | "text"
  | "canvas"
  | "record"
  | "tts";

/** Active interaction mode for the timeline / clip surface. */
export type EditorMode = "select" | "cut" | "hand" | "range";

export type EditorState = {
  /** Active interaction mode (cursor / hand / range / cut). */
  mode: EditorMode;
  /** Whether the export dialog is open. */
  isExporting: boolean;
  /** Whether the keyboard-shortcuts help overlay is open. */
  showHelp: boolean;
  projectName: string;
  canvas: CanvasSettings;
  assets: Record<string, MediaAsset>;
  tracks: Track[]; // ordered top-to-bottom in UI; render order = reverse for video
  clips: Record<string, Clip>;
  clipOrder: string[]; // for stable iteration
  // Playback
  playhead: number; // seconds
  playing: boolean;
  // UI
  activeTool: ToolId;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  /** A clicked empty gap on a track lane. Mutually exclusive with selectedClipId. */
  selectedGap: GapSelection | null;
  /** Time position (seconds) of the active snap point, or null when not dragging. */
  snapIndicator: number | null;
  /** Whether clip dragging snaps to clip edges and the playhead. */
  snapEnabled: boolean;
  /** Whether to show the volume automation envelope curves over audio clips. */
  showVolumeEnvelopes: boolean;
  /** Loop playback region. Active only when loopEnabled and loopIn < loopOut. */
  loopEnabled: boolean;
  loopIn: number;
  loopOut: number;
  /** Measured pixel width of the scrollable lane panel — used for fit-to-timeline. */
  lanePanelWidth: number;
  zoom: number; // pixels per second
  /** The clip ID currently being recorded live, or null when not recording. */
  recordingClipId: string | null;
  /** Last recorder error (e.g. permission denied). Cleared when recording starts. */
  recorderError: string | null;
  // Save state
  lastSavedAt: number | null;
};
