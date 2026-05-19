"use client";

/**
 * VideoExportDialog — export modal for the video editor.
 *
 * Composes `<ExportDialogShell>` with two interchangeable forms:
 *   • `<VideoExportForm>` — MP4/MOV + resolution + quality. MP4 is the
 *     fast WebAV-native path; MOV is a quick FFmpeg rewrap of the same
 *     H.264/AAC streams (see `lib/editor/export.ts`).
 *   • `<AudioExportForm>` — MP3/WAV/FLAC/M4A + bitrate + channels.
 *     Surfaced so the user can extract a project's soundtrack without
 *     bouncing to the audio editor.
 *
 * The dialog instance is mounted only while the user is exporting
 * (`{isExporting && <VideoExportDialog ... />}` in the parent), so each
 * open starts from a fresh component with initial state — no bulk-reset
 * effect, no `open` prop to thread.
 *
 * Submit dispatch
 * ---------------
 * The shell owns the single `<form>` element so it can drive the
 * primary "Export" button via native submit semantics. The dialog
 * forwards submission to whichever form is mounted via a ref the active
 * form populates on render. This keeps each form's submit logic
 * co-located with its own state — no state bloat in the parent — while
 * avoiding any DOM-level event-listener wiring.
 *
 * Cached result behaviour
 * -----------------------
 * The last successful render per mode is held in a session-scoped cache
 * (`lib/editor/last-export.ts`). The dialog always opens on the form;
 * when a cached render exists the footer surfaces "View last export" so
 * the user can opt back into it. "Adjust settings" from the result
 * panel returns to the form without discarding the cache.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { useEditor } from "@/lib/editor/store";
import { exportProject, type ExportFormat } from "@/lib/editor/export";
import {
  exportAudioProject,
  type AudioExportFormat,
} from "@/lib/audio/export";
import {
  setLastExport,
  useLastExport,
} from "@/lib/editor/last-export";
import ExportDialogShell, {
  FileNameInput,
  FormDivider,
  FormRow,
  SegmentedControl,
  SelectControl,
  type ExportProgress,
} from "@/components/editor/shared/ExportDialogShell";

/* ── Public API ──────────────────────────────────────────────────────── */

export interface VideoExportDialogProps {
  onClose: () => void;
}

export default function VideoExportDialog({ onClose }: VideoExportDialogProps) {
  const [mode, setMode] = useState<ExportMode>("video");
  const [view, setView] = useState<View>("form");
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Filename lives at the dialog level so it survives mode toggles
     within a single open. `null` means "untouched" — the field falls
     back to projectName / a default until the user types something. */
  const projectName = useEditor((s) => s.projectName);
  const [customFileName, setCustomFileName] = useState<string | null>(null);
  const fileName = customFileName ?? projectName ?? DEFAULT_FILE_NAME;

  /* Each mode caches independently — switching mode swaps which cached
     render the "View last export" affordance surfaces. */
  const cachedVideo = useLastExport("video");
  const cachedAudio = useLastExport("audio");
  const cachedResult = mode === "video" ? cachedVideo : cachedAudio;

  /* Active form populates this ref on render. The shell's onSubmit
     dispatches to whichever runner is currently registered, so each
     form can keep its submit logic next to its own form state. */
  const activeSubmitRef = useRef<(() => void) | null>(null);

  const lifecycle = useMemo<ExportLifecycle>(
    () => ({
      onStart: () => {
        setError(null);
        setView("progress");
        setProgress({ pct: 0, message: "Preparing…" });
      },
      onProgress: setProgress,
      onSuccess: ({ blob, ext }) => {
        setLastExport(mode, {
          url: URL.createObjectURL(blob),
          size: blob.size,
          ext,
        });
        setView("result");
        setProgress(null);
      },
      onError: (err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
        setView("form");
        setProgress(null);
      },
    }),
    [mode],
  );

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    activeSubmitRef.current?.();
  }, []);

  const handleShowLastExport = useCallback(() => {
    setView("result");
    setProgress(null);
    setError(null);
  }, []);

  const handleResetToForm = useCallback(() => {
    setView("form");
    setProgress(null);
    setError(null);
  }, []);

  return (
    <ExportDialogShell
      open
      onClose={onClose}
      title={mode === "video" ? "Export Video" : "Export Audio"}
      progress={view === "progress" ? progress : null}
      result={view === "result" ? cachedResult : null}
      renderPreview={renderResultPreview(mode)}
      downloadFileName={fileName}
      onSubmit={handleSubmit}
      onReset={handleResetToForm}
      onShowLastExport={cachedResult ? handleShowLastExport : undefined}
      error={error}
    >
      <ModeCheckbox
        checked={mode === "video"}
        onChange={(asVideo) => setMode(asVideo ? "video" : "audio")}
      />

      <FormDivider />

      {/* Re-mount the active form on mode change so its per-mode local
          state (format, quality, etc.) starts from a clean baseline —
          no stale audio fields lingering after a flip to video, and
          vice versa. The filename input stays mounted via the parent
          so it survives the switch. */}
      {mode === "video" ? (
        <VideoExportForm
          key="video"
          fileName={fileName}
          onFileNameChange={setCustomFileName}
          lifecycle={lifecycle}
          submitRef={activeSubmitRef}
        />
      ) : (
        <AudioExportForm
          key="audio"
          fileName={fileName}
          onFileNameChange={setCustomFileName}
          lifecycle={lifecycle}
          submitRef={activeSubmitRef}
        />
      )}
    </ExportDialogShell>
  );
}

const DEFAULT_FILE_NAME = "video-export";

/* ── Shared types ────────────────────────────────────────────────────── */

type ExportMode = "video" | "audio";
type View = "form" | "progress" | "result";

/** Lifecycle callbacks each form invokes through its run. */
interface ExportLifecycle {
  onStart: () => void;
  onProgress: (p: ExportProgress) => void;
  onSuccess: (run: { blob: Blob; ext: string }) => void;
  onError: (err: unknown) => void;
}

interface ExportFormProps {
  fileName: string;
  onFileNameChange: (next: string) => void;
  lifecycle: ExportLifecycle;
  /** Active form registers its submit handler here on every render. */
  submitRef: RefObject<(() => void) | null>;
}

/* ── Video form ──────────────────────────────────────────────────────── */

type PresetId = "1080p" | "720p" | "480p" | "source";

interface Preset {
  id: PresetId;
  label: string;
  /** null = inherit from canvas. */
  width: number | null;
  height: number | null;
}

const VIDEO_PRESETS: readonly Preset[] = [
  { id: "1080p", label: "1080p", width: 1920, height: 1080 },
  { id: "720p",  label: "720p",  width: 1280, height: 720  },
  { id: "480p",  label: "480p",  width: 854,  height: 480  },
  { id: "source", label: "Custom", width: null, height: null },
];

type VideoQuality = "high" | "medium" | "low";
const VIDEO_QUALITY_TO_CRF: Record<VideoQuality, number> = {
  high: 20,
  medium: 23,
  low: 28,
};

function VideoExportForm({
  fileName,
  onFileNameChange,
  lifecycle,
  submitRef,
}: ExportFormProps) {
  const canvas = useEditor((s) => s.canvas);

  /* Seeded from the current canvas so the dialog opens on whichever
     preset preserves the project at 1:1, or "Custom" for non-standard
     ratios. */
  const [presetId, setPresetId] = useState<PresetId>(() =>
    matchPresetFromCanvas(canvas),
  );
  const [quality, setQuality] = useState<VideoQuality>("high");
  const [format, setFormat] = useState<ExportFormat>("mp4");

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const preset =
    VIDEO_PRESETS.find((p) => p.id === presetId) ?? VIDEO_PRESETS[3];

  /* Register the submit runner via layout effect so the parent's
     `<form onSubmit>` lands on the freshest closure (capturing the
     latest format/preset/quality) without mutating refs during
     render. */
  useRegisterSubmit(submitRef, () => {
    lifecycle.onStart();
    void (async () => {
      try {
        const state = useEditor.getState();
        const blob = await exportProject(
          state,
          {
            format,
            width: preset.width ?? canvas.width,
            height: preset.height ?? canvas.height,
            fps: canvas.fps,
            crf: VIDEO_QUALITY_TO_CRF[quality],
          },
          lifecycle.onProgress,
        );
        lifecycle.onSuccess({ blob, ext: format });
      } catch (err) {
        lifecycle.onError(err);
      }
    })();
  });

  return (
    <>
      <FormRow label="File Name">
        <FileNameInput
          value={fileName}
          onChange={onFileNameChange}
          inputRef={inputRef}
          ext={format}
        />
      </FormRow>

      <FormDivider />

      <FormRow label="Format">
        <SelectControl
          value={format}
          onChange={(v) => setFormat(v as ExportFormat)}
          options={[
            { value: "mp4", label: "MP4 — H.264 / AAC" },
            { value: "mov", label: "MOV — QuickTime (H.264 / AAC)" },
          ]}
        />
      </FormRow>

      <FormRow label="Resolution">
        <SegmentedControl<PresetId>
          options={VIDEO_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
          value={presetId}
          onChange={setPresetId}
        />
      </FormRow>

      {/* "Custom" inherits the canvas dimensions — surface them inline
          so the user knows what they're about to render at without
          bouncing back to the PageBar's canvas picker. */}
      {presetId === "source" && (
        <CustomResolutionHint width={canvas.width} height={canvas.height} />
      )}

      <FormRow label="Quality">
        <SelectControl
          value={quality}
          onChange={(v) => setQuality(v as VideoQuality)}
          options={[
            { value: "high",   label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low",    label: "Low" },
          ]}
        />
      </FormRow>
    </>
  );
}

function matchPresetFromCanvas(canvas: {
  width: number;
  height: number;
}): PresetId {
  const match = VIDEO_PRESETS.find(
    (p) => p.width === canvas.width && p.height === canvas.height,
  );
  return match?.id ?? "source";
}

/* ── Audio form ──────────────────────────────────────────────────────── */

function AudioExportForm({
  fileName,
  onFileNameChange,
  lifecycle,
  submitRef,
}: ExportFormProps) {
  const [format, setFormat] = useState<AudioExportFormat>("mp3");
  const [bitrate, setBitrate] = useState<number>(256);
  const [channels, setChannels] = useState<1 | 2>(2);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* WAV / FLAC are lossless — bitrate is meaningless. Dim the row
     instead of hiding it so the layout stays stable. */
  const isBitrateDisabled = format === "wav" || format === "flac";

  useRegisterSubmit(submitRef, () => {
    lifecycle.onStart();
    void (async () => {
      try {
        const state = useEditor.getState();
        const blob = await exportAudioProject(
          state,
          { format, quality: bitrate, channels },
          lifecycle.onProgress,
        );
        lifecycle.onSuccess({ blob, ext: format });
      } catch (err) {
        lifecycle.onError(err);
      }
    })();
  });

  return (
    <>
      <FormRow label="File Name">
        <FileNameInput
          value={fileName}
          onChange={onFileNameChange}
          inputRef={inputRef}
          ext={format}
        />
      </FormRow>

      <FormDivider />

      <FormRow label="Format">
        <SegmentedControl<AudioExportFormat>
          options={[
            { value: "mp3",  label: "MP3" },
            { value: "wav",  label: "WAV" },
            { value: "flac", label: "FLAC" },
            { value: "m4a",  label: "M4A" },
          ]}
          value={format}
          onChange={setFormat}
        />
      </FormRow>

      <FormRow label="Quality" disabled={isBitrateDisabled}>
        <SelectControl
          value={bitrate}
          onChange={(v) => setBitrate(Number(v))}
          disabled={isBitrateDisabled}
          options={[
            { value: "128", label: "128 kbps" },
            { value: "192", label: "192 kbps" },
            { value: "256", label: "256 kbps" },
            { value: "320", label: "320 kbps" },
          ]}
        />
      </FormRow>

      <FormRow label="Channels">
        <SegmentedControl<"1" | "2">
          options={[
            { value: "1", label: "Mono" },
            { value: "2", label: "Stereo" },
          ]}
          value={String(channels) as "1" | "2"}
          onChange={(v) => setChannels(Number(v) as 1 | 2)}
        />
      </FormRow>
    </>
  );
}

/* ── Submit registration ─────────────────────────────────────────────── */

/**
 * Publishes a form's submit handler to the parent dialog via the shared
 * ref, refreshing on every render so the latest closure (and therefore
 * the latest form state) is what the parent's `<form onSubmit>` ends
 * up calling.
 *
 * Why a layout effect: we need the ref populated before any user click
 * lands, and we need to clean it up on unmount so a freshly-mounted
 * sibling form (e.g. after a mode flip) doesn't observe the previous
 * form's handler in the brief moment between cleanup and re-register.
 */
function useRegisterSubmit(
  ref: RefObject<(() => void) | null>,
  handler: () => void,
): void {
  useLayoutEffect(() => {
    ref.current = handler;
    return () => {
      if (ref.current === handler) ref.current = null;
    };
  });
}

/* ── Small UI bits ───────────────────────────────────────────────────── */

function renderResultPreview(mode: ExportMode) {
  return function ResultPreview(r: { url: string; ext: string; size: number }) {
    return mode === "video" ? (
      <video
        src={r.url}
        controls
        style={{ width: "100%", borderRadius: 8, background: "black" }}
      />
    ) : (
      <audio
        src={r.url}
        controls
        style={{
          width: "100%",
          height: 32,
          outline: "none",
          borderRadius: 8,
        }}
      />
    );
  };
}

function ModeCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        userSelect: "none",
        fontSize: 13,
        color: "rgba(255,255,255,0.9)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          width: 16,
          height: 16,
          accentColor: "#ffffff",
          cursor: "pointer",
        }}
      />
      Export as video
      <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
        — uncheck to export audio only
      </span>
    </label>
  );
}

function CustomResolutionHint({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <div
      style={{
        marginTop: -8,
        paddingLeft: 88, // 72px label column + 16px gap
        fontSize: 11,
        color: "rgba(255,255,255,0.45)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      Will render at {width}×{height} (canvas size).
    </div>
  );
}
