"use client";

/**
 * Video export dialog. Composes the shared <ExportDialogShell> with a
 * small preset list (1080p / 720p / 480p) and the existing exportProject
 * helper. Stays under 200 lines because all chrome (modal, progress,
 * result, footer) lives in the shell and the format-specific shape is
 * driven by a single preset table.
 *
 * Dual mode
 * ---------
 * A top-of-form "Export as video" checkbox flips this dialog between two
 * modes:
 *   • checked  (default) → video form (MP4/MOV + resolution + quality)
 *   • unchecked          → audio form (MP3/WAV/FLAC/M4A + quality +
 *                          channels), running `exportAudioProject` so
 *                          the user can extract just the soundtrack
 *                          without leaving the video editor.
 * Title, file extension, last-export cache key, and result preview all
 * follow the mode.
 *
 * Cached result behavior
 * ----------------------
 * The last successful render is held in a session-scoped cache (see
 * `lib/editor/last-export.ts`). The dialog always opens on the form
 * (re-rendering would be wasted work; auto-skipping it would hide the
 * primary action). When a cached render exists the form footer surfaces
 * a "View last export" button so the user can opt-in to revisiting it
 * — and from the result panel "Adjust settings" returns them to the
 * form. A fresh Export always renders and replaces the cached blob.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const DEFAULT_FILE_NAME = "video-export";

type PresetId = "1080p" | "720p" | "480p" | "source";

type Preset = {
  id: PresetId;
  label: string;
  width: number | null; // null = match canvas
  height: number | null;
};

const PRESETS: Preset[] = [
  { id: "1080p", label: "1080p", width: 1920, height: 1080 },
  { id: "720p", label: "720p", width: 1280, height: 720 },
  { id: "480p", label: "480p", width: 854, height: 480 },
  /* "Custom" inherits whatever dimensions the editor's canvas is set to
     — the actual values are surfaced as a hint below the segmented
     control so the user doesn't have to leave the dialog to check them. */
  { id: "source", label: "Custom", width: null, height: null },
];

/**
 * Picks the preset that matches the current canvas dimensions exactly,
 * or "Custom" (`"source"`) when no preset matches. Used as the initial
 * selection on every dialog open so the user lands on the option that
 * preserves their canvas at 1:1 — they can still manually downsample
 * (e.g. pick "720p" on a 1080p canvas) without further configuration.
 */
function matchPresetFromCanvas(
  canvas: { width: number; height: number },
): PresetId {
  const match = PRESETS.find(
    (p) => p.width === canvas.width && p.height === canvas.height,
  );
  return match?.id ?? "source";
}

type Quality = "high" | "medium" | "low";
const QUALITY_TO_CRF: Record<Quality, number> = { high: 20, medium: 23, low: 28 };

/**
 * View state of the dialog body. Decoupled from the cache so the user
 * can flip between the form and the cached result without altering it.
 */
type View = "form" | "progress" | "result";

export default function VideoExportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const projectName = useEditor((s) => s.projectName);
  const canvas = useEditor((s) => s.canvas);

  /* `customFileName` tracks user edits. Until they type anything, the input
     mirrors `projectName` (or falls back to a sensible default) — so we
     don't need an effect that would mutate state during render. */
  const [customFileName, setCustomFileName] = useState<string | null>(null);
  const fileName = customFileName ?? projectName ?? DEFAULT_FILE_NAME;

  /* Mode toggle. `true` (default) = export video; `false` = audio-only.
     Title, file extension, available form fields, cached-result panel
     and the encoder called on submit all derive from this. */
  const [exportAsVideo, setExportAsVideo] = useState(true);

  /* ── video form state ──────────────────────────────────────────────── */
  /* Seeded from the current canvas size so the dialog opens on whichever
     preset preserves the project at 1:1 (or "Custom" for non-standard
     ratios). Re-synced on every reopen — see the effect below. */
  const [presetId, setPresetId] = useState<PresetId>(() =>
    matchPresetFromCanvas(canvas),
  );
  const [quality, setQuality] = useState<Quality>("high");
  /* Output container. MP4 is the fast WebAV-native path; MOV is a
     cheap FFmpeg rewrap. The MOV path is a re-mux rather than a
     re-encode, so picking it doesn't change encoding time. */
  const [format, setFormat] = useState<ExportFormat>("mp4");

  /* ── audio form state ──────────────────────────────────────────────── */
  const [audioFormat, setAudioFormat] = useState<AudioExportFormat>("mp3");
  const [audioBitrate, setAudioBitrate] = useState<number>(256);
  const [channels, setChannels] = useState<1 | 2>(2);

  /* Each mode caches independently — switching mode swaps which cached
     render the "View last export" button surfaces. */
  const cachedVideo = useLastExport("video");
  const cachedAudio = useLastExport("audio");
  const cachedResult = exportAsVideo ? cachedVideo : cachedAudio;

  /* Local view state — independent of the cache so "Adjust settings"
     can hide the result without discarding it. */
  const [view, setView] = useState<View>("form");
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  /* The dialog always opens on the form. The cached render (if any) is
     reachable via the secondary "View last export" button rendered in
     the form footer when `cachedResult` is non-null.
     The setState calls are a one-shot reset to a known state when
     `open` flips false → true; the rule's loop guard isn't relevant
     because `open` only changes via external user action.
     The preset is also re-synced from the current canvas: a 1280×720
     canvas should land on "720p" on every reopen, etc. The user can
     still override the auto-selection within a session — the override
     persists until the dialog is closed and reopened with a (possibly
     different) canvas. */
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView("form");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPresetId(matchPresetFromCanvas(canvas));
    // `canvas` intentionally omitted: the resync runs only when `open`
    // transitions false → true, not whenever the canvas changes (which
    // can't happen while the modal is mounted anyway, since the canvas
    // dropdown is in the PageBar behind the backdrop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Focus the filename field when the form is the current view. */
  useEffect(() => {
    if (open && view === "form") inputRef.current?.focus();
  }, [open, view]);

  const preset = useMemo(
    () => PRESETS.find((p) => p.id === presetId)!,
    [presetId],
  );

  /* "Adjust settings" — flip back to the form, keep the cached result
     in place so the user can return to it via the "View last export"
     button. Form inputs (filename / resolution / quality) persist in
     local state across this transition. */
  const handleReset = useCallback(() => {
    setView("form");
    setProgress(null);
    setError(null);
  }, []);

  /* "View last export" — surface the cached render without re-rendering. */
  const handleShowLastExport = useCallback(() => {
    setView("result");
    setProgress(null);
    setError(null);
  }, []);

  /* Close — drop view-state but keep the cache. */
  const handleClose = useCallback(() => {
    setProgress(null);
    setError(null);
    onClose();
  }, [onClose]);

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setView("progress");
    setProgress({ pct: 0, message: "Preparing…" });
    try {
      const state = useEditor.getState();
      if (exportAsVideo) {
        const blob = await exportProject(
          state,
          {
            format,
            width: preset.width ?? canvas.width,
            height: preset.height ?? canvas.height,
            fps: canvas.fps,
            crf: QUALITY_TO_CRF[quality],
          },
          (p) => setProgress(p),
        );
        /* Writing to the cache automatically revokes the previous blob URL
           (see last-export.ts), so we never accumulate stale blobs across
           repeated exports. */
        setLastExport("video", {
          url: URL.createObjectURL(blob),
          size: blob.size,
          ext: format,
        });
      } else {
        const blob = await exportAudioProject(
          state,
          { format: audioFormat, quality: audioBitrate, channels },
          (p) => setProgress(p),
        );
        setLastExport("audio", {
          url: URL.createObjectURL(blob),
          size: blob.size,
          ext: audioFormat,
        });
      }
      setView("result");
      setProgress(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setView("form");
      setProgress(null);
    }
  }

  /* What the shell renders for the result panel. When view !== "result"
     we hand it null so it falls back to the form / progress body. */
  const shellResult = view === "result" ? cachedResult : null;

  /* WAV/FLAC are lossless — bitrate row is greyed out for them. */
  const isAudioBitrateDisabled =
    audioFormat === "wav" || audioFormat === "flac";

  const currentExt = exportAsVideo ? format : audioFormat;
  const title = exportAsVideo ? "Export Video" : "Export Audio";

  return (
    <ExportDialogShell
      open={open}
      onClose={handleClose}
      title={title}
      progress={view === "progress" ? progress : null}
      result={shellResult}
      renderPreview={(r) =>
        exportAsVideo ? (
          <video
            src={r.url}
            controls
            style={{ width: "100%", borderRadius: 8, background: "black" }}
          />
        ) : (
          <audio
            src={r.url}
            controls
            style={{ width: "100%", height: 32, outline: "none", borderRadius: 8 }}
          />
        )
      }
      downloadFileName={fileName}
      onSubmit={handleExport}
      onReset={handleReset}
      onShowLastExport={cachedResult ? handleShowLastExport : undefined}
      error={error}
    >
      <ModeCheckbox checked={exportAsVideo} onChange={setExportAsVideo} />

      <FormDivider />

      <FormRow label="File Name">
        <FileNameInput
          value={fileName}
          onChange={setCustomFileName}
          inputRef={inputRef}
          ext={currentExt}
        />
      </FormRow>

      <FormDivider />

      {exportAsVideo ? (
        <>
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
              options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
              value={presetId}
              onChange={setPresetId}
            />
          </FormRow>

          {/* When the user picks "Custom" the actual dimensions live on the
              canvas, not in the preset table — surface them inline so the
              user knows what they're about to render at without bouncing
              back to the PageBar's canvas pill. */}
          {presetId === "source" && (
            <CustomResolutionHint
              width={canvas.width}
              height={canvas.height}
            />
          )}

          <FormRow label="Quality">
            <SelectControl
              value={quality}
              onChange={(v) => setQuality(v as Quality)}
              options={[
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]}
            />
          </FormRow>
        </>
      ) : (
        <>
          <FormRow label="Format">
            <SegmentedControl<AudioExportFormat>
              options={[
                { value: "mp3", label: "MP3" },
                { value: "wav", label: "WAV" },
                { value: "flac", label: "FLAC" },
                { value: "m4a", label: "M4A" },
              ]}
              value={audioFormat}
              onChange={setAudioFormat}
            />
          </FormRow>

          <FormRow label="Quality" disabled={isAudioBitrateDisabled}>
            <SelectControl
              value={audioBitrate}
              onChange={(v) => setAudioBitrate(Number(v))}
              disabled={isAudioBitrateDisabled}
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
      )}
    </ExportDialogShell>
  );
}

/**
 * Top-of-form mode toggle. Unchecking flips the dialog from "Export
 * Video" to "Export Audio" — see the doc-comment on the parent.
 */
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

/**
 * Inline hint that mirrors the canvas dimensions back to the user when
 * "Custom" is selected. Pinned to the controls column with a 72px +
 * 16px left inset so it visually attaches to the row above without
 * mimicking the row's label / value split (which would make it look
 * like an editable field).
 */
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
