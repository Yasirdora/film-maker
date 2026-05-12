"use client";

/**
 * Video export dialog. Composes the shared <ExportDialogShell> with a
 * small preset list (1080p / 720p / 480p) and the existing exportProject
 * helper. Stays under 200 lines because all chrome (modal, progress,
 * result, footer) lives in the shell and the format-specific shape is
 * driven by a single preset table.
 *
 * Cached result behavior
 * ----------------------
 * The last successful render is held in a session-scoped cache (see
 * `lib/editor/last-export.ts`). When the dialog re-opens the user lands
 * directly on the result panel showing that render instead of an empty
 * form — re-rendering the same project from scratch on every reopen
 * would be slow and unexpected. "Adjust settings" drops them back to
 * the form (cache stays) so they can tweak resolution / quality /
 * filename and produce a new render that overwrites the cache.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "@/lib/editor/store";
import { exportProject } from "@/lib/editor/export";
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
  { id: "source", label: "Match canvas", width: null, height: null },
];

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

  const [presetId, setPresetId] = useState<PresetId>("1080p");
  const [quality, setQuality] = useState<Quality>("high");

  /* The cached render (or null). When non-null the dialog opens straight
     into the result panel; "Adjust settings" flips the view back to the
     form without touching the cache. */
  const cachedResult = useLastExport("video");

  /* Local view state — independent of the cache so "Adjust settings"
     can hide the result without discarding it. */
  const [view, setView] = useState<View>("form");
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  /* When the dialog opens, decide the initial view. A cached render
     means the user wants to revisit the last result; otherwise we go
     straight to the form. Done in an effect rather than at render time
     so toggling `open` from false → true triggers the snapshot exactly
     once per open. */
  useEffect(() => {
    if (!open) return;
    setView(cachedResult ? "result" : "form");
    setProgress(null);
    setError(null);
    // `cachedResult` is intentionally omitted: it would re-flip the view
    // every time the cache changes (e.g. after a successful render),
    // which is handled explicitly by the success path below.
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
     so the user can return to it via close + reopen if they change
     their mind. Form inputs (filename / resolution / quality) persist
     in local state across this transition. */
  const handleReset = useCallback(() => {
    setView("form");
    setProgress(null);
    setError(null);
  }, []);

  /* Close — drop view-state but keep the cache. Reopening will show the
     cached result. */
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
      /* Writing to the cache automatically revokes the previous blob URL
         (see last-export.ts), so we never accumulate stale blobs across
         repeated exports. */
      setLastExport("video", {
        url: URL.createObjectURL(blob),
        size: blob.size,
        ext: "mp4",
      });
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

  return (
    <ExportDialogShell
      open={open}
      onClose={handleClose}
      title="Export Video"
      progress={view === "progress" ? progress : null}
      result={shellResult}
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
