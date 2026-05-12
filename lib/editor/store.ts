"use client";

import { create } from "zustand";
import { clock, quantizeToFrame } from "./clock";
import { releaseTrackBus } from "./audio";
import { defaultTrackColor } from "./trackColors";
import { probeFile } from "./media";
import { reverseMediaFile } from "./ffmpeg";
import {
  cancelRecording,
  pauseRecording,
  recorderElapsed,
  recorderState,
  resumeRecording,
  startRecording,
  stopRecording,
} from "./recorder";
import { clearPeaks, getPeaks } from "@/lib/audio/peaks";
import { discardLivePeaks, startLivePeaks, stopLivePeaks } from "./livePeaks";
import type {
  CanvasSettings,
  Clip,
  ClipKind,
  EditorMode,
  EditorState,
  GapSelection,
  MediaAsset,
  TextClip,
  ToolId,
  Track,
  Transform,
} from "./types";

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Module-local handle to the in-progress recording so we can finalize / discard. */
let _liveRecording: {
  assetId: string;
  clipId: string;
  trackId: string;
  startTime: number;
  ticker: ReturnType<typeof setInterval> | null;
} | null = null;

/** Cadence at which the in-progress clip's duration is bumped in the store. 50ms = 20fps. */
const LIVE_CLIP_TICK_MS = 50;

const defaultTransform = (canvas: CanvasSettings): Transform => ({
  x: canvas.width / 2,
  y: canvas.height / 2,
  scale: 1,
  rotation: 0,
  opacity: 1,
  flipX: false,
  flipY: false,
});

const initialCanvas: CanvasSettings = {
  width: 1920,
  height: 1080,
  background: "#000000",
  fps: 30,
};

const baseTracks = (): Track[] => [
  {
    id: uid(),
    kind: "video",
    muted: false,
    soloed: false,
    locked: false,
    hidden: false,
    collapsed: false,
    name: "",
    color: defaultTrackColor(0),
    volume: 1,
  },
  {
    id: uid(),
    kind: "audio",
    muted: false,
    soloed: false,
    locked: false,
    hidden: false,
    collapsed: false,
    name: "",
    color: defaultTrackColor(0),
    volume: 1,
  },
];

/**
 * Note on time:
 *   `playhead` and `playing` are NOT stored in the Zustand store. The
 *   `EditorClock` singleton owns them. Components that need to render at
 *   frame rate subscribe via `useClockTime()` / `useClockPlaying()` so the
 *   store is not churned 60 times a second.
 *
 *   Action methods that need to read the current time (e.g. split-at-playhead)
 *   call `clock.time()` directly.
 */

type StoreState = Omit<EditorState, "playhead" | "playing">;

type HistoryEntry = Pick<StoreState, "tracks" | "clips" | "clipOrder" | "canvas" | "assets">;

type InternalState = StoreState & {
  _past: HistoryEntry[];
  _future: HistoryEntry[];
  _clipboard: Clip | null;
};

// Module-level coalescing: rapid repeated calls to the same drag action share one history entry.
let _coalescingKey = "";
let _coalescingMs = 0;
const COALESCE_MS = 600;

/** Stashed volume levels for clip-level mute/unmute so restore is exact. */
const _mutedVolumes = new Map<string, number>();

function needsPush(key: string): boolean {
  const now = Date.now();
  if (key === _coalescingKey && now - _coalescingMs < COALESCE_MS) {
    _coalescingMs = now;
    return false;
  }
  _coalescingKey = key;
  _coalescingMs = now;
  return true;
}

type Actions = {
  setProjectName: (name: string) => void;
  setCanvas: (patch: Partial<CanvasSettings>) => void;

  setActiveTool: (id: ToolId) => void;
  setSelectedClip: (id: string | null) => void;
  setZoom: (z: number) => void;

  // Time controls — thin wrappers around the clock. Always quantize to fps.
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  /**
   * Single transport toggle for the dock's play button + spacebar shortcut.
   * Pauses/resumes the recorder when active; otherwise toggles playback.
   * Keeps the user from juggling two parallel control sets.
   */
  transportToggle: () => void;
  /**
   * Single record toggle for the dock's record button. Idle → start recording;
   * recording or paused → stop and import the take onto the timeline.
   */
  recorderToggle: () => Promise<void>;
  /** Discard the in-progress recording without importing. */
  recorderCancel: () => void;
  setRecorderError: (msg: string | null) => void;
  seek: (t: number) => void;
  stepFrames: (delta: number) => void;
  stepSeconds: (delta: number) => void;

  addAsset: (asset: MediaAsset) => void;
  removeAsset: (id: string) => void;

  addClipFromAsset: (
    assetId: string,
    opts?: { trackId?: string; start?: number },
  ) => string | null;
  addTextClip: (fontFamily?: string) => string;

  updateClip: (id: string, patch: Partial<Clip>) => void;
  updateClipTransform: (id: string, patch: Partial<Transform>) => void;
  trimClipStart: (id: string, newStart: number) => void;
  trimClipEnd: (id: string, newEnd: number) => void;
  splitSelectedAtPlayhead: () => void;
  splitClipAtTime: (id: string, time: number) => void;
  splitAtLoopBoundaries: () => void;
  copyClip: () => void;
  cutClip: () => void;
  pasteClip: () => void;
  duplicateClip: () => void;
  moveClip: (id: string, newStart: number, newTrackId?: string) => void;
  /**
   * Resolve overlap with siblings on the clip's current track at its current
   * start/duration. Intended to be called once at the end of a drag (move or
   * trim), so live drags can pass over siblings without progressively eating
   * them frame-by-frame.
   */
  commitClipEdit: (id: string) => void;
  removeClip: (id: string) => void;
  /** Toggle the clip's disabled/bypass state. */
  toggleClipDisabled: (id: string) => void;
  /** Replace the clip's body color with a hex value (e.g. one of TRACK_COLORS). */
  setClipColor: (id: string, color: string) => void;
  reverseClip: (id: string) => Promise<void>;
  /** Toggle clip-level mute. Stashes previous volume so unmute restores it. */
  toggleClipMute: (id: string) => void;
  /**
   * Ripple-delete a gap on one track: shift every clip on that track that
   * starts at or after `toTime` left by `(toTime - fromTime)`. Other tracks
   * are untouched, matching DaVinci/Premiere's per-track gap deletion.
   */
  closeGap: (trackId: string, fromTime: number, toTime: number) => void;

  updateTrack: (id: string, patch: Partial<Track>) => void;
  addTrack: (kind: Track["kind"]) => string;
  removeTrack: (id: string) => void;
  /**
   * Reorder a track relative to others of the same kind. Audio tracks
   * only swap with audio tracks; the cross-kind ordering is preserved
   * (so moving an audio track "up" never reshuffles the video stack).
   */
  moveTrack: (id: string, direction: "up" | "down") => void;
  /** Clone a track and all its clips. Returns the new track id. */
  duplicateTrack: (id: string) => string | null;

  setSelectedTrack: (id: string | null) => void;
  setSelectedGap: (gap: GapSelection | null) => void;
  setSnapIndicator: (t: number | null) => void;
  setSnapEnabled: (v: boolean) => void;
  setMode: (m: EditorMode) => void;
  setExporting: (v: boolean) => void;
  setShowHelp: (v: boolean) => void;
  setLoopEnabled: (v: boolean) => void;
  setLoopIn: (t: number) => void;
  setLoopOut: (t: number) => void;
  setLanePanelWidth: (w: number) => void;

  totalDuration: () => number;

  setRecordingClipId: (id: string | null) => void;

  undo: () => void;
  redo: () => void;
  _pushHistory: () => void;
  toggleVolumeEnvelopes: () => void;
};

export const useEditor = create<InternalState & Actions>((set, get) => ({
  projectName: "Untitled project",
  canvas: initialCanvas,
  assets: {},
  tracks: baseTracks(),
  clips: {},
  clipOrder: [],
  activeTool: "files",
  mode: "select",
  isExporting: false,
  showHelp: false,
  selectedClipId: null,
  selectedTrackId: null,
  selectedGap: null,
  snapIndicator: null,
  snapEnabled: true,
  showVolumeEnvelopes: false,
  _clipboard: null,
  loopEnabled: false,
  loopIn: 0,
  loopOut: 0,
  lanePanelWidth: 0,
  zoom: 60, // pixels per second
  recordingClipId: null,
  recorderError: null,
  lastSavedAt: null,
  _past: [],
  _future: [],

  toggleVolumeEnvelopes: () => set((s) => ({ showVolumeEnvelopes: !s.showVolumeEnvelopes })),
  setRecordingClipId: (id) => set({ recordingClipId: id }),
  setProjectName: (name) => set({ projectName: name }),
  setCanvas: (patch) => { get()._pushHistory(); set({ canvas: { ...get().canvas, ...patch } }); },
  setActiveTool: (id) => set({ activeTool: id }),
  setSelectedClip: (id) => {
    /* Invariant: selecting a clip also activates its host track so the
       active-track indicator (3 px stripe in the headers column) follows
       the user's last interaction. Deselecting a clip leaves the active
       track alone — clicking the empty timeline shouldn't blank the row
       the user just worked on. */
    const c = id ? get().clips[id] : null;
    set({
      selectedClipId: id,
      selectedTrackId: c ? c.trackId : get().selectedTrackId,
      selectedGap: id ? null : get().selectedGap,
    });
  },
  setZoom: (z) => set({ zoom: Math.max(1, Math.min(300, z)) }),

  play: () => clock.play(),
  pause: () => clock.pause(),
  togglePlay: () => clock.toggle(),

  /**
   * Single transport toggle. While recording, pauses both recorder and clock
   * together (otherwise a paused recorder + rolling clock would leave silent
   * gaps in the take). Otherwise toggles playback as normal.
   */
  transportToggle: () => {
    const rs = recorderState();
    if (rs === "recording") {
      pauseRecording();
      clock.pause();
      return;
    }
    if (rs === "paused") {
      resumeRecording();
      clock.play();
      return;
    }
    clock.toggle();
  },

  recorderToggle: async () => {
    const rs = recorderState();

    // ── Stop + finalize branch ───────────────────────────────────────────
    if (rs !== "idle") {
      const live = _liveRecording;
      if (live?.ticker) clearInterval(live.ticker);
      stopLivePeaks();
      // Capture elapsed before `stopRecording` resets the recorder to idle.
      const elapsedAtStop = recorderElapsed();
      clock.pause();

      const file = await stopRecording();

      if (!live) {
        // No live session was set up (defensive; shouldn't happen). Fall
        // back to the simple "import as new clip" path.
        if (file) {
          try {
            const asset = await probeFile(file);
            get().addAsset(asset);
            get().addClipFromAsset(asset.id);
            getPeaks(asset.id, asset.url).catch(() => {});
          } catch (err) {
            console.error("Failed to import recording:", err);
            set({ recorderError: "Failed to import the recording." });
          }
        }
        return;
      }

      if (!file) {
        // Mic produced no audio — discard the placeholder clip + asset.
        const { [live.clipId]: _c, ...restClips } = get().clips;
        const { [live.assetId]: _a, ...restAssets } = get().assets;
        clearPeaks(live.assetId);
        set({
          clips: restClips,
          clipOrder: get().clipOrder.filter((id) => id !== live.clipId),
          assets: restAssets,
          recordingClipId: null,
        });
        _liveRecording = null;
        return;
      }

      try {
        const probed = await probeFile(file);
        // Some codecs report duration: 0 in metadata until the file is fully
        // demuxed. Fall back to the recorder's own elapsed counter so the
        // clip ends up at the right size.
        const finalDuration = probed.duration > 0 ? probed.duration : elapsedAtStop;

        // Reuse the synthetic asset id we've been writing peaks under, so the
        // cache and the clip's assetId stay valid through the swap.
        const finalAsset: MediaAsset = {
          id: live.assetId,
          name: probed.name,
          kind: "audio",
          url: probed.url,
          duration: finalDuration,
          width: 0,
          height: 0,
          size: probed.size,
          mime: probed.mime,
          source: "recording",
        };

        // Invalidate the low-resolution live peaks; full peaks recompute from
        // the captured file on the next render of this clip's WaveformCanvas.
        clearPeaks(live.assetId);
        getPeaks(live.assetId, finalAsset.url).catch(() => {});

        const clip = get().clips[live.clipId];
        const finalizedClip: Clip | undefined = clip
          ? ({ ...clip, duration: finalDuration, disabled: false } as Clip)
          : undefined;

        /* Punch-in / punch-out: the recording occupies [recStart, recEnd]
           on its track. For every other clip on the same track:
             • no overlap                              → untouched
             • recording fully covers the clip         → delete it
             • recording overlaps the clip's right end → trim that end back
             • recording overlaps the clip's left end  → trim that start
                                                          forward, advancing
                                                          inPoint to keep the
                                                          source mapping
             • recording sits inside the clip          → split into head + tail,
                                                          tail's inPoint advances
           Anything outside [recStart, recEnd] is preserved exactly. */
        const recStart = live.startTime;
        const recEnd = recStart + finalDuration;
        const updatedNeighbors: Record<string, Clip> = {};
        const removedIds = new Set<string>();
        const splitTails: Array<{ id: string; clip: Clip }> = [];

        for (const id of get().clipOrder) {
          if (id === live.clipId) continue;
          const c = get().clips[id];
          if (!c || c.trackId !== live.trackId) continue;

          const a = c.start;
          const b = c.start + c.duration;
          if (b <= recStart || a >= recEnd) continue; // disjoint — keep as-is

          if (recStart <= a && b <= recEnd) {
            removedIds.add(id);
          } else if (a < recStart && recEnd < b) {
            // Split: head keeps [a, recStart], tail starts at recEnd.
            updatedNeighbors[id] = { ...c, duration: recStart - a } as Clip;
            const tailId = uid();
            splitTails.push({
              id: tailId,
              clip: {
                ...c,
                id: tailId,
                start: recEnd,
                duration: b - recEnd,
                inPoint: c.inPoint + (recEnd - a),
              } as Clip,
            });
          } else if (a < recStart) {
            // Overlap on right side of clip — trim end back to recStart.
            updatedNeighbors[id] = { ...c, duration: recStart - a } as Clip;
          } else {
            // Overlap on left side of clip — trim start forward to recEnd.
            const delta = recEnd - a;
            updatedNeighbors[id] = {
              ...c,
              start: recEnd,
              duration: b - recEnd,
              inPoint: c.inPoint + delta,
            } as Clip;
          }
        }

        const nextClips = { ...get().clips };
        for (const [id, c] of Object.entries(updatedNeighbors)) nextClips[id] = c;
        for (const id of removedIds) delete nextClips[id];
        for (const { id, clip: tail } of splitTails) nextClips[id] = tail;
        if (finalizedClip) nextClips[live.clipId] = finalizedClip;

        const nextOrder = get()
          .clipOrder.filter((id) => !removedIds.has(id))
          .concat(splitTails.map((s) => s.id));

        set({
          assets: { ...get().assets, [live.assetId]: finalAsset },
          clips: nextClips,
          clipOrder: nextOrder,
          recordingClipId: null,
        });
      } catch (err) {
        console.error("Failed to import recording:", err);
        set({ recorderError: "Failed to import the recording." });
      } finally {
        _liveRecording = null;
      }
      return;
    }

    // ── Start branch ─────────────────────────────────────────────────────
    set({ recorderError: null });
    const ok = await startRecording();
    if (!ok) {
      set({
        recorderError:
          "Microphone access denied. Please allow microphone permissions and try again.",
      });
      return;
    }

    // Reserve ids and find/create an audio track for the take.
    const assetId = uid();
    const clipId = uid();
    const startTime = clock.time();
    /* Track choice precedence:
         1. The currently selected audio track (the user's explicit target).
         2. The audio track of the currently selected clip — gives a sensible
            fallback when the user has been editing on a track but hasn't
            clicked its header.
         3. The first audio track in the project.
         4. A freshly-created audio track (only when none exist). */
    const stateAtStart = get();
    const audioTracks = stateAtStart.tracks.filter((tr) => tr.kind === "audio");
    const selectedAudioTrack = audioTracks.find(
      (tr) => tr.id === stateAtStart.selectedTrackId,
    );
    const selectedClip = stateAtStart.selectedClipId
      ? stateAtStart.clips[stateAtStart.selectedClipId]
      : null;
    const selectedClipAudioTrack = selectedClip
      ? audioTracks.find((tr) => tr.id === selectedClip.trackId)
      : undefined;
    let track =
      selectedAudioTrack ?? selectedClipAudioTrack ?? audioTracks[0];
    if (!track) {
      const id = get().addTrack("audio");
      track = get().tracks.find((tr) => tr.id === id)!;
    }

    /* Existing clips are left untouched while recording. Punch-in/out
       resolution happens at stop time, when the take's actual final range
       [recStart, recEnd] is known — we then split or trim only the parts
       that the new take covers, preserving everything outside that window. */

    // Synthetic asset placeholder — url filled in on stop. mediaController
    // skips disabled clips and clips without urls, so playback is unaffected.
    const placeholderAsset: MediaAsset = {
      id: assetId,
      name: "Recording",
      kind: "audio",
      url: "",
      duration: 0,
      width: 0,
      height: 0,
      size: 0,
      mime: "audio/webm",
      source: "recording",
    };
    const placeholderClip: Clip = {
      id: clipId,
      trackId: track.id,
      kind: "audio",
      assetId,
      start: startTime,
      duration: 0,
      inPoint: 0,
      speed: 1,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      disabled: true,
      color: track.color,
      transform: defaultTransform(get().canvas),
    };

    set({
      assets: { ...get().assets, [assetId]: placeholderAsset },
      clips: { ...get().clips, [clipId]: placeholderClip },
      clipOrder: [...get().clipOrder, clipId],
      recordingClipId: clipId,
      selectedTrackId: track.id,
    });

    // Start the live-peaks pipeline (registers an analyser listener).
    startLivePeaks(assetId, recorderElapsed);

    // Bump clip.duration in the store at LIVE_CLIP_TICK_MS cadence. This
    // triggers WaveformCanvas to redraw with the latest peaks (which the
    // listener has been mutating in place).
    const ticker = setInterval(() => {
      const live = _liveRecording;
      if (!live || recorderState() === "idle") return;
      const elapsed = recorderElapsed();
      const c = get().clips[live.clipId];
      if (!c) return;
      set({
        clips: { ...get().clips, [live.clipId]: { ...c, duration: elapsed } as Clip },
      });
    }, LIVE_CLIP_TICK_MS);

    _liveRecording = {
      assetId,
      clipId,
      trackId: track.id,
      startTime,
      ticker,
    };

    // Roll the playhead so the user sees the take being laid down under the
    // running timecode.
    clock.play();
  },

  recorderCancel: () => {
    const live = _liveRecording;
    if (live?.ticker) clearInterval(live.ticker);
    discardLivePeaks();
    cancelRecording();
    clock.pause();

    if (live) {
      const { [live.clipId]: _c, ...restClips } = get().clips;
      const { [live.assetId]: _a, ...restAssets } = get().assets;
      set({
        clips: restClips,
        clipOrder: get().clipOrder.filter((id) => id !== live.clipId),
        assets: restAssets,
        recordingClipId: null,
      });
    }
    _liveRecording = null;
    set({ recorderError: null });
  },

  setRecorderError: (msg) => set({ recorderError: msg }),

  seek: (t) => clock.seek(quantizeToFrame(t, get().canvas.fps)),
  stepFrames: (delta) => {
    const fps = get().canvas.fps;
    clock.seek(quantizeToFrame(clock.time() + delta / fps, fps));
  },
  stepSeconds: (delta) => clock.seek(clock.time() + delta),

  addAsset: (asset) => set((s) => ({ assets: { ...s.assets, [asset.id]: asset } })),
  removeAsset: (id) => {
    get()._pushHistory();
    const { [id]: _, ...rest } = get().assets;
    set({ assets: rest });
  },

  addClipFromAsset: (assetId, opts) => {
    get()._pushHistory();
    const s = get();
    const asset = s.assets[assetId];
    if (!asset) return null;
    const trackKind: Track["kind"] = asset.kind === "audio" ? "audio" : "video";
    // When the caller specifies a track, honor it. Otherwise always spawn a
    // fresh track for the new clip so imports/recordings don't pile up on
    // an existing one and overlap whatever's already there.
    let track: Track | undefined;
    if (opts?.trackId) {
      track = s.tracks.find((t) => t.id === opts.trackId);
    }
    if (!track) {
      const newId = get().addTrack(trackKind);
      track = get().tracks.find((t) => t.id === newId)!;
    }
    const id = uid();
    // Default placement is the playhead; callers that need to sequence
    // multiple imports back-to-back pass an explicit `start`.
    const start = quantizeToFrame(
      opts?.start ?? clock.time(),
      s.canvas.fps,
    );
    const dur = asset.duration > 0 ? asset.duration : 5;
    const clip: Clip = {
      id,
      trackId: track.id,
      kind: asset.kind,
      assetId,
      start,
      duration: dur,
      inPoint: 0,
      speed: 1,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      disabled: false,
      color: track.color,
      transform: defaultTransform(s.canvas),
    };
    set({
      clips: { ...s.clips, [id]: clip },
      clipOrder: [...s.clipOrder, id],
      selectedClipId: id,
      selectedTrackId: track.id,
    });
    return id;
  },

  addTextClip: (fontFamily?: string) => {
    get()._pushHistory();
    const s = get();
    let track = s.tracks.find((t) => t.kind === "text");
    if (!track) {
      const id = get().addTrack("text");
      track = get().tracks.find((t) => t.id === id)!;
    }
    const id = uid();
    const clip: TextClip = {
      id,
      trackId: track.id,
      kind: "text",
      start: clock.time(),
      duration: 4,
      inPoint: 0,
      speed: 1,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      disabled: false,
      color: track.color,
      style: {
        text: "Add text",
        fontFamily: fontFamily || "Google Sans, sans-serif",
        fontSize: 96,
        fontWeight: 500,
        color: "#ffffff",
        bgColor: null,
        align: "center",
        padding: 16,
      },
      transform: defaultTransform(s.canvas),
    };
    set({
      clips: { ...s.clips, [id]: clip },
      clipOrder: [...s.clipOrder, id],
      selectedClipId: id,
      selectedTrackId: track.id,
      activeTool: "text",
    });
    return id;
  },

  updateClip: (id, patch) => {
    const s = get();
    const c = s.clips[id];
    if (!c) return;
    if (needsPush("updateClip:" + id)) get()._pushHistory();
    /* If the patch reassigns the selected clip to a different track,
       carry the active-track indicator over so the headers column
       reflects the new home. Same invariant as moveClip. */
    const reassignsSelected =
      patch.trackId !== undefined &&
      patch.trackId !== c.trackId &&
      s.selectedClipId === id;
    set({
      clips: { ...s.clips, [id]: { ...c, ...patch } as Clip },
      ...(reassignsSelected ? { selectedTrackId: patch.trackId } : null),
    });
  },

  updateClipTransform: (id, patch) => {
    const c = get().clips[id];
    if (!c || c.kind === "audio") return;
    if (needsPush("updateClipTransform:" + id)) get()._pushHistory();
    const next = {
      ...c,
      transform: { ...(c as Exclude<Clip, { kind: "audio" }>).transform, ...patch },
    } as Clip;
    set({ clips: { ...get().clips, [id]: next } });
  },

  trimClipStart: (id, newStart) => {
    const s = get();
    const c = s.clips[id];
    if (!c) return;
    if (needsPush("trimClipStart:" + id)) get()._pushHistory();
    const minStart = c.start - c.inPoint; // can't trim before in=0
    const maxStart = c.start + c.duration - 0.1;
    const clamped = Math.max(minStart, Math.min(maxStart, newStart));
    const delta = clamped - c.start;
    const newDuration = c.duration - delta;
    // Allow free overlap during the trim; siblings are resolved on
    // commitClipEdit once the drag ends.
    set({
      clips: {
        ...s.clips,
        [id]: {
          ...c,
          start: clamped,
          inPoint: c.inPoint + delta,
          duration: newDuration,
        } as Clip,
      },
    });
  },

  trimClipEnd: (id, newEnd) => {
    const s = get();
    const c = s.clips[id];
    if (!c) return;
    if (needsPush("trimClipEnd:" + id)) get()._pushHistory();
    let newDuration = Math.max(0.1, newEnd - c.start);
    if ((c.kind === "audio" || c.kind === "video") && c.assetId) {
      const asset = s.assets[c.assetId];
      if (asset?.duration > 0) {
        newDuration = Math.min(newDuration, asset.duration - c.inPoint);
      }
    }
    // Allow free overlap during the trim; siblings are resolved on
    // commitClipEdit once the drag ends.
    set({
      clips: { ...s.clips, [id]: { ...c, duration: newDuration } as Clip },
    });
  },

  splitSelectedAtPlayhead: () => {
    const s = get();
    const t = clock.time();
    const MIN_DUR = 0.05;
    const lockedTracks = new Set(s.tracks.filter((tr) => tr.locked).map((tr) => tr.id));

    let newClips = { ...s.clips };
    let newOrder = [...s.clipOrder];
    let didSplit = false;

    for (const id of s.clipOrder) {
      const c = newClips[id];
      if (!c || lockedTracks.has(c.trackId)) continue;
      if (t <= c.start + MIN_DUR || t >= c.start + c.duration - MIN_DUR) continue;

      const offset = t - c.start;
      const rightId = uid();
      newClips = {
        ...newClips,
        [c.id]: { ...c, duration: offset } as Clip,
        [rightId]: { ...c, id: rightId, start: t, duration: c.duration - offset, inPoint: c.inPoint + offset } as Clip,
      };
      newOrder = [...newOrder, rightId];
      didSplit = true;
    }

    if (didSplit) {
      get()._pushHistory();
      set({ clips: newClips, clipOrder: newOrder });
    }
  },

  splitClipAtTime: (id, t) => {
    get()._pushHistory();
    const s = get();
    const c = s.clips[id];
    if (!c) return;
    if (t <= c.start + 0.05 || t >= c.start + c.duration - 0.05) return;
    const offset = t - c.start;
    const left: Clip = { ...c, duration: offset } as Clip;
    const rightId = uid();
    const right: Clip = {
      ...c,
      id: rightId,
      start: t,
      duration: c.duration - offset,
      inPoint: c.inPoint + offset,
    } as Clip;
    set({
      clips: { ...s.clips, [c.id]: left, [rightId]: right },
      clipOrder: [...s.clipOrder, rightId],
    });
  },

  splitAtLoopBoundaries: () => {
    const s = get();
    if (s.loopIn >= s.loopOut) return;
    get()._pushHistory();

    const MIN_DUR = 0.05;
    const lockedTracks = new Set(s.tracks.filter((t) => t.locked).map((t) => t.id));

    const splitAt = (
      t: number,
      clips: Record<string, Clip>,
      clipOrder: string[],
    ): { clips: Record<string, Clip>; clipOrder: string[] } => {
      let c2 = { ...clips };
      let o2 = [...clipOrder];
      for (const id of [...clipOrder]) {
        const c = c2[id];
        if (!c || lockedTracks.has(c.trackId)) continue;
        if (t <= c.start + MIN_DUR || t >= c.start + c.duration - MIN_DUR) continue;
        const offset = t - c.start;
        const rightId = uid();
        c2 = {
          ...c2,
          [c.id]: { ...c, duration: offset } as Clip,
          [rightId]: { ...c, id: rightId, start: t, duration: c.duration - offset, inPoint: c.inPoint + offset } as Clip,
        };
        o2 = [...o2, rightId];
      }
      return { clips: c2, clipOrder: o2 };
    };

    const after1 = splitAt(s.loopIn, s.clips, s.clipOrder);
    const after2 = splitAt(s.loopOut, after1.clips, after1.clipOrder);
    set({ clips: after2.clips, clipOrder: after2.clipOrder });
  },

  copyClip: () => {
    const s = get();
    const c = s.selectedClipId ? s.clips[s.selectedClipId] : null;
    if (c) set({ _clipboard: c });
  },

  cutClip: () => {
    const s = get();
    const c = s.selectedClipId ? s.clips[s.selectedClipId] : null;
    if (!c) return;
    get()._pushHistory();
    const { [c.id]: _gone, ...rest } = get().clips;
    set({
      _clipboard: c,
      clips: rest,
      clipOrder: get().clipOrder.filter((x) => x !== c.id),
      selectedClipId: null,
    });
  },

  pasteClip: () => {
    const s = get();
    const src = s._clipboard;
    if (!src) return;
    get()._pushHistory();

    /* Destination track: honor the active track when its kind is
       compatible with the clipboard's clip — that's how a "copy →
       click another track → paste" gesture is meant to land. Fall
       back to the source clip's original track only when the active
       selection isn't usable.

       Kind compatibility: audio→audio, text→text, video/image→video. */
    const requiredKind: Track["kind"] =
      src.kind === "audio" ? "audio" : src.kind === "text" ? "text" : "video";
    const activeTrack = s.selectedTrackId
      ? s.tracks.find(
          (t) => t.id === s.selectedTrackId && t.kind === requiredKind,
        )
      : undefined;
    const destTrackId = activeTrack?.id ?? src.trackId;

    const newId = uid();
    const pasteStart = clock.time();
    const pasted: Clip = {
      ...src,
      id: newId,
      start: pasteStart,
      trackId: destTrackId,
    } as Clip;
    // Trim any clips that overlap the pasted clip's position on the
    // destination track.
    const { clips: trimmedClips, clipOrder: trimmedOrder } = trimOverlappingSiblings(
      newId, pasteStart, src.duration, destTrackId, s.clips, s.clipOrder,
    );
    set({
      clips: { ...trimmedClips, [newId]: pasted },
      clipOrder: [...trimmedOrder, newId],
      selectedClipId: newId,
      selectedTrackId: destTrackId,
    });
  },

  duplicateClip: () => {
    const s = get();
    const c = s.selectedClipId ? s.clips[s.selectedClipId] : null;
    if (!c) return;
    get()._pushHistory();
    const newId = uid();
    const dupStart = c.start + c.duration;
    const duped: Clip = { ...c, id: newId, start: dupStart } as Clip;
    // Trim any clips that overlap the duplicated clip's position.
    const { clips: trimmedClips, clipOrder: trimmedOrder } = trimOverlappingSiblings(
      newId, dupStart, c.duration, c.trackId, s.clips, s.clipOrder,
    );
    set({
      clips: { ...trimmedClips, [newId]: duped },
      clipOrder: [...trimmedOrder, newId],
      selectedClipId: newId,
      selectedTrackId: c.trackId,
    });
  },

  moveClip: (id, newStart, newTrackId?) => {
    const s = get();
    const c = s.clips[id];
    if (!c) return;
    if (needsPush("moveClip:" + id)) get()._pushHistory();
    const clampedStart = Math.max(0, newStart);
    // Allow free overlap during the move; siblings are resolved on
    // commitClipEdit once the drag ends.
    const patch: Partial<Clip> = { start: clampedStart };
    const crossingTracks =
      newTrackId !== undefined && newTrackId !== c.trackId;
    if (crossingTracks) patch.trackId = newTrackId;
    /* When the moved clip is the user's current selection and crosses
       to a new track, the active-track indicator must follow it.
       Without this the headers column keeps lighting up the source
       track until the user re-clicks the clip. */
    const followsSelection = crossingTracks && s.selectedClipId === id;
    set({
      clips: { ...s.clips, [id]: { ...c, ...patch } as Clip },
      ...(followsSelection ? { selectedTrackId: newTrackId } : null),
    });
  },

  commitClipEdit: (id) => {
    const s = get();
    const c = s.clips[id];
    if (!c) return;
    const { clips: trimmedClips, clipOrder: trimmedOrder } = trimOverlappingSiblings(
      id, c.start, c.duration, c.trackId, s.clips, s.clipOrder,
    );
    set({ clips: trimmedClips, clipOrder: trimmedOrder });
  },

  removeClip: (id) => {
    get()._pushHistory();
    const { [id]: _gone, ...rest } = get().clips;
    set({
      clips: rest,
      clipOrder: get().clipOrder.filter((x) => x !== id),
      selectedClipId: get().selectedClipId === id ? null : get().selectedClipId,
    });
  },

  toggleClipDisabled: (id) => {
    const c = get().clips[id];
    if (!c) return;
    get()._pushHistory();
    set({ clips: { ...get().clips, [id]: { ...c, disabled: !c.disabled } as Clip } });
  },

  setClipColor: (id, color) => {
    const c = get().clips[id];
    if (!c || c.color === color) return;
    get()._pushHistory();
    set({ clips: { ...get().clips, [id]: { ...c, color } as Clip } });
  },

  reverseClip: async (id) => {
    const s = get();
    const clip = s.clips[id];
    if (!clip || clip.kind === "text" || clip.kind === "image") return;

    // Cache playing state and pause the transport to prevent media desync
    const wasPlaying = clock.playing();
    if (wasPlaying) clock.pause();

    // Push clean state to history BEFORE setting the loading flag
    if (needsPush("reverseClip:" + id)) get()._pushHistory();

    set({ clips: { ...get().clips, [id]: { ...clip, isProcessing: true } as Clip } });

    try {
      const asset = s.assets[clip.assetId];
      if (!asset) throw new Error("Asset not found");

      const reversedFile = await reverseMediaFile(asset.url, clip.kind, asset.name);
      const newAsset = await probeFile(reversedFile);
      
      get().addAsset(newAsset);
      
      const newInPoint = asset.duration > 0 
        ? Math.max(0, asset.duration - (clip.inPoint + clip.duration)) 
        : 0;
      
      set({
        clips: {
          ...get().clips,
          [id]: { ...clip, assetId: newAsset.id, inPoint: newInPoint, isProcessing: false } as Clip,
        },
      });

      // Auto-resume if the timeline was actively playing when the operation started.
      // We use a small timeout to let the DOM flush and mediaPool instantiate the new asset.
      if (wasPlaying) {
        setTimeout(() => clock.play(), 50);
      }
    } catch (e) {
      console.error(e);
      set({ clips: { ...get().clips, [id]: { ...clip, isProcessing: false } as Clip } });
      if (wasPlaying) clock.play();
    }
  },

  toggleClipMute: (id) => {
    const c = get().clips[id];
    if (!c) return;
    get()._pushHistory();
    if (c.volume > 0) {
      // Stash current volume so unmute restores it.
      _mutedVolumes.set(id, c.volume);
      set({ clips: { ...get().clips, [id]: { ...c, volume: 0 } as Clip } });
    } else {
      const restored = _mutedVolumes.get(id) ?? 1;
      _mutedVolumes.delete(id);
      set({ clips: { ...get().clips, [id]: { ...c, volume: restored } as Clip } });
    }
  },

  closeGap: (trackId, fromTime, toTime) => {
    const delta = toTime - fromTime;
    if (delta <= 1e-6) return;
    get()._pushHistory();
    const next: Record<string, Clip> = { ...get().clips };
    for (const c of Object.values(get().clips)) {
      if (c.trackId !== trackId) continue;
      /* Shift only clips that sit fully past the gap. The clip ending at
         `fromTime` (the gap's left edge) must stay in place. */
      if (c.start >= toTime - 1e-6) {
        next[c.id] = { ...c, start: Math.max(0, c.start - delta) } as Clip;
      }
    }
    set({ clips: next, selectedGap: null });
  },

  updateTrack: (id, patch) => {
    if (needsPush("updateTrack:" + id)) get()._pushHistory();
    
    let currentTracks = get().tracks;
    
    // Exclusive solo: if we are turning solo ON for this track, turn it OFF for all others
    if (patch.soloed === true) {
      currentTracks = currentTracks.map((t) => 
        t.id === id ? t : { ...t, soloed: false }
      );
    }
    
    set({ tracks: currentTracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  },

  addTrack: (kind) => {
    const id = uid();
    const sameKindCount = get().tracks.filter((t) => t.kind === kind).length;
    set({
      tracks: [
        ...get().tracks,
        {
          id,
          kind,
          muted: false,
          soloed: false,
          locked: false,
          hidden: false,
          collapsed: false,
          name: "",
          color: defaultTrackColor(sameKindCount),
          volume: 1,
        },
      ],
    });
    return id;
  },

  removeTrack: (id) => {
    get()._pushHistory();
    const s = get();
    const orphanedClipIds = new Set(
      Object.values(s.clips)
        .filter((c) => c.trackId === id)
        .map((c) => c.id),
    );
    set({
      tracks: s.tracks.filter((t) => t.id !== id),
      clips: Object.fromEntries(
        Object.entries(s.clips).filter(([cid]) => !orphanedClipIds.has(cid)),
      ),
      clipOrder: s.clipOrder.filter((cid) => !orphanedClipIds.has(cid)),
      selectedClipId:
        s.selectedClipId && orphanedClipIds.has(s.selectedClipId)
          ? null
          : s.selectedClipId,
      selectedTrackId: s.selectedTrackId === id ? null : s.selectedTrackId,
      selectedGap: s.selectedGap?.trackId === id ? null : s.selectedGap,
    });
    // Audio bus owned by the engine, outside React; release after the
    // store update so any React subscriber that runs synchronously sees
    // the track gone first.
    queueMicrotask(() => releaseTrackBus(id));
  },

  moveTrack: (id, direction) => {
    get()._pushHistory();
    const tracks = get().tracks;
    const from = tracks.findIndex((t) => t.id === id);
    if (from < 0) return;
    const kind = tracks[from].kind;
    const sameKindIndices = tracks
      .map((t, i) => (t.kind === kind ? i : -1))
      .filter((i) => i >= 0);
    const posInKind = sameKindIndices.indexOf(from);
    const targetPosInKind =
      direction === "up" ? posInKind - 1 : posInKind + 1;
    if (targetPosInKind < 0 || targetPosInKind >= sameKindIndices.length) return;
    const to = sameKindIndices[targetPosInKind];
    const next = tracks.slice();
    [next[from], next[to]] = [next[to], next[from]];
    set({ tracks: next });
  },

  duplicateTrack: (id) => {
    get()._pushHistory();
    const s = get();
    const src = s.tracks.find((t) => t.id === id);
    if (!src) return null;
    const newId = uid();
    const copy: Track = { ...src, id: newId };
    const srcIdx = s.tracks.findIndex((t) => t.id === id);
    const tracks = [
      ...s.tracks.slice(0, srcIdx + 1),
      copy,
      ...s.tracks.slice(srcIdx + 1),
    ];
    /* Clone every clip on the source track, preserving relative timing. */
    const newClips: Record<string, Clip> = { ...s.clips };
    const newOrder = s.clipOrder.slice();
    for (const cid of s.clipOrder) {
      const c = s.clips[cid];
      if (!c || c.trackId !== id) continue;
      const cloneId = uid();
      newClips[cloneId] = { ...c, id: cloneId, trackId: newId } as Clip;
      newOrder.push(cloneId);
    }
    set({ tracks, clips: newClips, clipOrder: newOrder });
    return newId;
  },

  setSelectedTrack: (id) => set({ selectedTrackId: id, selectedGap: id ? null : get().selectedGap }),
  setSelectedGap: (gap) => set({
    selectedGap: gap,
    selectedClipId: gap ? null : get().selectedClipId,
    /* A gap belongs to exactly one track — selecting it activates that
       track so the headers column reflects the user's focus. Clearing
       the gap leaves the active track untouched (same rationale as
       setSelectedClip). */
    selectedTrackId: gap ? gap.trackId : get().selectedTrackId,
  }),
  setSnapIndicator: (t) => set({ snapIndicator: t }),
  setSnapEnabled: (v) => set({ snapEnabled: v }),
  setMode: (m) => set({ mode: m }),
  setExporting: (v) => set({ isExporting: v }),
  setShowHelp: (v) => set({ showHelp: v }),
  setLoopEnabled: (v) => {
    const s = get();
    clock.setLoop(v, s.loopIn, s.loopOut);
    set({ loopEnabled: v });
  },
  setLoopIn: (t) => {
    const s = get();
    const clamped = Math.max(0, Math.min(clock.max(), t));
    clock.setLoop(s.loopEnabled, clamped, s.loopOut);
    set({ loopIn: clamped });
  },
  setLoopOut: (t) => {
    const s = get();
    const clamped = Math.max(0, Math.min(clock.max(), t));
    clock.setLoop(s.loopEnabled, s.loopIn, clamped);
    set({ loopOut: clamped });
  },
  setLanePanelWidth: (w) => set({ lanePanelWidth: w }),

  _pushHistory: () => {
    const s = get();
    const snap: HistoryEntry = {
      tracks: s.tracks,
      clips: s.clips,
      clipOrder: s.clipOrder,
      canvas: s.canvas,
      assets: s.assets,
    };
    set({ _past: [...s._past.slice(-49), snap], _future: [] });
  },

  undo: () => {
    const s = get();
    if (!s._past.length) return;

    const wasPlaying = clock.playing();
    if (wasPlaying) clock.pause();

    const prev = s._past[s._past.length - 1];
    const curr: HistoryEntry = {
      tracks: s.tracks,
      clips: s.clips,
      clipOrder: s.clipOrder,
      canvas: s.canvas,
      assets: s.assets,
    };
    _coalescingKey = "";
    set({ ...prev, _past: s._past.slice(0, -1), _future: [curr, ...s._future.slice(0, 49)] });

    if (wasPlaying) setTimeout(() => clock.play(), 50);
  },

  redo: () => {
    const s = get();
    if (!s._future.length) return;

    const wasPlaying = clock.playing();
    if (wasPlaying) clock.pause();

    const next = s._future[0];
    const curr: HistoryEntry = {
      tracks: s.tracks,
      clips: s.clips,
      clipOrder: s.clipOrder,
      canvas: s.canvas,
      assets: s.assets,
    };
    _coalescingKey = "";
    set({ ...next, _past: [...s._past.slice(-49), curr], _future: s._future.slice(1) });

    if (wasPlaying) setTimeout(() => clock.play(), 50);
  },

  totalDuration: () => {
    let m = 0;
    for (const id of get().clipOrder) {
      const c = get().clips[id];
      if (!c) continue;
      m = Math.max(m, c.start + c.duration);
    }
    return Math.max(m, 5);
  },
}));

/* ── Overlap prevention helpers ────────────────────────────────────── */

/** Collect sibling clips on the same track, sorted by start time. */
function siblingsOnTrack(
  excludeId: string,
  trackId: string,
  clips: Record<string, Clip>,
  order: string[],
): Clip[] {
  const out: Clip[] = [];
  for (const id of order) {
    if (id === excludeId) continue;
    const c = clips[id];
    if (c && c.trackId === trackId) out.push(c);
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

/**
 * Trim (or remove) any sibling clips that overlap with the moved clip's new
 * position. Returns updated clips dict and clipOrder with removals applied.
 */
function trimOverlappingSiblings(
  clipId: string,
  newStart: number,
  duration: number,
  trackId: string,
  clips: Record<string, Clip>,
  order: string[],
): { clips: Record<string, Clip>; clipOrder: string[] } {
  const newEnd = newStart + duration;
  let updatedClips = { ...clips };
  let updatedOrder = order;

  for (const id of order) {
    if (id === clipId) continue;
    const sib = updatedClips[id];
    if (!sib || sib.trackId !== trackId) continue;
    const sibEnd = sib.start + sib.duration;

    // No overlap — ranges are disjoint.
    if (newEnd <= sib.start || newStart >= sibEnd) continue;

    // Full overlap — the moved clip completely covers this sibling: remove it.
    if (newStart <= sib.start && newEnd >= sibEnd) {
      const { [id]: _removed, ...rest } = updatedClips;
      updatedClips = rest;
      updatedOrder = updatedOrder.filter((x) => x !== id);
      continue;
    }

    // Partial overlap from the left — trim the sibling's start forward.
    if (newEnd > sib.start && newEnd < sibEnd && newStart <= sib.start) {
      const trimAmount = newEnd - sib.start;
      updatedClips = {
        ...updatedClips,
        [id]: {
          ...sib,
          start: newEnd,
          inPoint: sib.inPoint + trimAmount,
          duration: sib.duration - trimAmount,
        } as Clip,
      };
      continue;
    }

    // Partial overlap from the right — trim the sibling's end back.
    if (newStart > sib.start && newStart < sibEnd && newEnd >= sibEnd) {
      const newDuration = newStart - sib.start;
      updatedClips = {
        ...updatedClips,
        [id]: { ...sib, duration: newDuration } as Clip,
      };
      continue;
    }

    // The moved clip sits entirely inside the sibling — split the sibling
    // around it so the right-hand portion survives instead of being lost.
    if (newStart > sib.start && newEnd < sibEnd) {
      const leftDuration = newStart - sib.start;
      const rightOffset = newEnd - sib.start;
      const rightId = uid();
      updatedClips = {
        ...updatedClips,
        [id]: { ...sib, duration: leftDuration } as Clip,
        [rightId]: {
          ...sib,
          id: rightId,
          start: newEnd,
          duration: sibEnd - newEnd,
          inPoint: sib.inPoint + rightOffset,
        } as Clip,
      };
      updatedOrder = updatedOrder.includes(rightId) ? updatedOrder : [...updatedOrder, rightId];
    }
  }

  return { clips: updatedClips, clipOrder: updatedOrder };
}



/** Selectors to derive frame-time-dependent slices without subscribing to the store at frame rate. */
export function selectVisibleClipsAt(
  s: Pick<StoreState, "tracks" | "clips" | "clipOrder">,
  t: number,
): Clip[] {
  // Pre-build track lookup maps once (O(tracks)) instead of .find() per clip (O(tracks*clips)).
  const trackMap = new Map<string, { hidden: boolean; idx: number }>();
  s.tracks.forEach((tr, i) => trackMap.set(tr.id, { hidden: tr.hidden, idx: i }));

  const out: Clip[] = [];
  for (const id of s.clipOrder) {
    const c = s.clips[id];
    if (!c || c.kind === "audio" || c.disabled) continue;
    const tr = trackMap.get(c.trackId);
    if (!tr || tr.hidden) continue;
    if (t >= c.start && t < c.start + c.duration) out.push(c);
  }
  return out.sort((a, b) => (trackMap.get(b.trackId)?.idx ?? 0) - (trackMap.get(a.trackId)?.idx ?? 0));
}

export type { ClipKind };
