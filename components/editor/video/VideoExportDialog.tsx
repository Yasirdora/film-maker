"use client";

/**
 * Video export dialog. Composes the shared <ExportDialogShell> with a small
 * preset list (1080p / 720p / 480p) and the existing exportProject helper.
 * Stays under 200 lines because all chrome (modal, progress, result, footer)
 * lives in the shell and the format-specific shape is driven by a single
 * preset table.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "@/lib/editor/store";
import { exportProject } from "@/lib/editor/export";
import ExportDialogShell, {
  FileNameInput,
  FormDivider,
  FormRow,
  SegmentedControl,
  SelectControl,
  type ExportProgress,
  type ExportResult,
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
  { id: "source", label: "Match canvas", width: null, height: null },
];

type Quality = "high" | "medium" | "low";
const QUALITY_TO_CRF: Record<Quality, number> = { high: 20, medium: 23, low: 28 };

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

  const [presetId, setPresetId] = useState<PresetId>("1080p");
  const [quality, setQuality] = useState<Quality>("high");

  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  /* Focus the filename field when there's no progress/result panel showing. */
  useEffect(() => {
    if (open && !progress && !result) inputRef.current?.focus();
  }, [open, progress, result]);

  const preset = useMemo(
    () => PRESETS.find((p) => p.id === presetId)!,
    [presetId],
  );

  /* Revoke the current result's object URL so the browser can release
     the underlying blob. Safe to call when `result` is null. */
  const revokeResultUrl = useCallback(() => {
    if (result?.url) URL.revokeObjectURL(result.url);
  }, [result]);

  /* Reset the dialog back to its form state without closing it. Form
     inputs (filename, resolution, quality) intentionally persist so the
     user can tweak and re-render in one click. */
  const handleReset = useCallback(() => {
    revokeResultUrl();
    setResult(null);
    setProgress(null);
    setError(null);
  }, [revokeResultUrl]);

  /* Revoke any outstanding URL on close so a stale blob can't survive
     into the next mount and leak. */
  const handleClose = useCallback(() => {
    revokeResultUrl();
    setResult(null);
    setProgress(null);
    setError(null);
    onClose();
  }, [revokeResultUrl, onClose]);

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    revokeResultUrl();
    setResult(null);
    setProgress({ pct: 0, message: "Preparing…" });
    try {
      const state = useEditor.getState();
      const blob = await exportProject(
        state,
        {
          format: "mp4",
          width: preset.width ?? canvas.width,
          height: preset.height ?? canvas.height,
          fps: canvas.fps,
          crf: QUALITY_TO_CRF[quality],
        },
        (p) => setProgress(p),
      );
      setResult({ url: URL.createObjectURL(blob), size: blob.size, ext: "mp4" });
      setProgress(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setProgress(null);
    }
  }

  return (
    <ExportDialogShell
      open={open}
      onClose={handleClose}
      title="Export Video"
      progress={progress}
      result={result}
      renderPreview={(r) => (
        <video
          src={r.url}
          controls
          style={{ width: "100%", borderRadius: 8, background: "black" }}
        />
      )}
      downloadFileName={fileName}
      onSubmit={handleExport}
      onReset={handleReset}
      error={error}
    >
      <FormRow label="File Name">
        <FileNameInput
          value={fileName}
          onChange={setCustomFileName}
          inputRef={inputRef}
          ext="mp4"
        />
      </FormRow>

      <FormDivider />

      <FormRow label="Resolution">
        <SegmentedControl<PresetId>
          options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
          value={presetId}
          onChange={setPresetId}
        />
      </FormRow>

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
    </ExportDialogShell>
  );
}
