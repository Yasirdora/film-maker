"use client";

/**
 * Audio export dialog. Composes the shared <ExportDialogShell> with audio
 * format options (MP3 / WAV / FLAC, quality, channels) and the audio export
 * function. The shell owns lifecycle (open/close/Escape/animation) and the
 * progress + result panels; this file owns the format-specific form.
 */

import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/lib/editor/store";
import { exportAudioProject, type AudioExportFormat } from "@/lib/audio/export";
import ExportDialogShell, {
  FileNameInput,
  FormDivider,
  FormRow,
  SegmentedControl,
  SelectControl,
  type ExportProgress,
  type ExportResult,
} from "@/components/editor/shared/ExportDialogShell";

const DEFAULT_FILE_NAME = "audio-export";

export default function ExportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const projectName = useEditor((s) => s.projectName);

  /* `customFileName` tracks user edits. Until they type anything, the input
     mirrors `projectName` (or falls back to a sensible default). Storing
     `null` for "untouched" lets us avoid an effect that would otherwise
     have to setState during render — the displayed name is just derived. */
  const [customFileName, setCustomFileName] = useState<string | null>(null);
  const fileName = customFileName ?? projectName ?? DEFAULT_FILE_NAME;

  const [format, setFormat] = useState<AudioExportFormat>("mp3");
  const [quality, setQuality] = useState<number>(256);
  const [channels, setChannels] = useState<1 | 2>(2);
  const [range, setRange] = useState<"whole" | "in_out">("whole");

  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  /* Focus the filename input on open (skip when showing progress/result). */
  useEffect(() => {
    if (open && !progress && !result) inputRef.current?.focus();
  }, [open, progress, result]);

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setProgress({ pct: 0, message: "Preparing…" });
    try {
      const state = useEditor.getState();
      const blob = await exportAudioProject(
        state,
        { format, quality, channels },
        (p) => setProgress(p),
      );
      setResult({ url: URL.createObjectURL(blob), size: blob.size, ext: format });
      setProgress(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setProgress(null);
    }
  }

  /* WAV/FLAC are lossless — bitrate is meaningless and the row is greyed out. */
  const isQualityDisabled = format === "wav" || format === "flac";

  return (
    <ExportDialogShell
      open={open}
      onClose={onClose}
      title="Export Audio"
      progress={progress}
      result={result}
      renderPreview={(r) =>
        r.ext === "mp4" ? (
          <video
            src={r.url}
            controls
            style={{ width: "100%", height: 48, outline: "none", borderRadius: 8 }}
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
      error={error}
    >
      <FormRow label="File Name">
        <FileNameInput
          value={fileName}
          onChange={setCustomFileName}
          inputRef={inputRef}
          ext={format}
        />
      </FormRow>

      <FormDivider />

      <FormRow label="Format">
        <SegmentedControl<AudioExportFormat>
          options={[
            { value: "mp3", label: "MP3" },
            { value: "wav", label: "WAV" },
            { value: "flac", label: "FLAC" },
            { value: "mp4", label: "MP4" },
          ]}
          value={format}
          onChange={setFormat}
        />
      </FormRow>

      <FormRow label="Quality" disabled={isQualityDisabled}>
        <SelectControl
          value={quality}
          onChange={(v) => setQuality(Number(v))}
          disabled={isQualityDisabled}
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

      <FormDivider />

      <FormRow label="Render">
        <SelectControl
          value={range}
          onChange={(v) => setRange(v as "whole" | "in_out")}
          options={[
            { value: "whole", label: "Entire Timeline" },
            { value: "in_out", label: "In/Out Range", disabled: true },
          ]}
        />
      </FormRow>
    </ExportDialogShell>
  );
}
