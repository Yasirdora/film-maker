"use client";

/**
 * Photo export dialog. Composes the shared `<ExportDialogShell>` with
 * a small filename / format / quality form, identical in shape to the
 * video and audio dialogs so the three editors speak the same export
 * language.
 *
 * Form fields
 * -----------
 *   • File name — defaults to the source's base name. The shell wraps
 *     `FileNameInput`; the extension renders alongside via the `ext`
 *     prop so users see the final filename without having to type it.
 *   • Format — PNG / JPEG / WebP. PNG is lossless and ignores the
 *     quality slider; JPEG and WebP use it.
 *   • Compression — 1–100 slider, framed as "quality" (higher = better
 *     image, larger file). Disabled when the chosen format is lossless.
 *
 * Cached result
 * -------------
 * Like the video / audio dialogs, the dialog always opens on the form
 * to keep the primary action one click away. A "View last export"
 * affordance appears in the form footer when a cached render exists,
 * and "Adjust settings" in the result panel flips the view back to the
 * form without throwing the cached blob away. A fresh export always
 * renders and replaces the cache (the cache module revokes the
 * previous URL on every write).
 */

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    exportImage,
    extensionFor,
    isLossless,
    supportsTransparency,
    type ExportFormat,
    type LoadedImage,
} from "@/lib/editor/photo";
import { setLastExport, useLastExport } from "@/lib/editor/last-export";
import ExportDialogShell, {
    FileNameInput,
    FormDivider,
    FormRow,
    SegmentedControl,
    type ExportProgress,
} from "@/components/editor/shared/ExportDialogShell";

const DEFAULT_FILE_NAME = "photo-export";

/* Default quality (1–100) for the lossy formats. 92 matches the value
 * the legacy split-button used and is the conventional "looks pristine
 * to the eye" point for JPEG. */
const DEFAULT_QUALITY = 92;

const FORMAT_OPTIONS: Array<{ value: ExportFormat; label: string }> = [
    { value: "png", label: "PNG" },
    { value: "jpeg", label: "JPG" },
    { value: "webp", label: "WEBP" },
    { value: "avif", label: "AVIF" },
];

/* Segmented control over a boolean — `true` = preserve alpha,
 * `false` = flatten onto a solid background. Labels match the user's
 * mental model rather than the underlying flag name. */
const TRANSPARENCY_OPTIONS: Array<{ value: "yes" | "no"; label: string }> = [
    { value: "yes", label: "Transparent" },
    { value: "no", label: "Solid" },
];

/**
 * View state of the dialog body. Decoupled from the cache so the user
 * can flip between the form and the cached result without altering it.
 */
type View = "form" | "progress" | "result";

interface PhotoExportDialogProps {
    open: boolean;
    onClose: () => void;
    /** The currently loaded image. The dialog won't open without one,
     *  but the prop is typed nullable so the parent doesn't have to
     *  conditionally render the component. */
    image: LoadedImage | null;
}

export default function PhotoExportDialog({
    open,
    onClose,
    image,
}: PhotoExportDialogProps) {
    /* ── Form state ──────────────────────────────────────────────── */

    /* `customFileName` tracks user edits. Until the user types
       anything, the input mirrors the source's base name (or a sane
       default) — so we don't need an effect that would mutate state
       during render. */
    const [customFileName, setCustomFileName] = useState<string | null>(null);
    const baseName = useMemo(
        () => image?.fileName.replace(/\.[^./\\]+$/, "") || DEFAULT_FILE_NAME,
        [image?.fileName],
    );
    const fileName = customFileName ?? baseName;

    const [format, setFormat] = useState<ExportFormat>("png");
    const [quality, setQuality] = useState<number>(DEFAULT_QUALITY);
    /* Preserve alpha by default — most users opening "photo editor →
       export" want a faithful pass-through. The transparency segment
       below is auto-disabled when the format doesn't support it (JPG)
       and the value is effectively forced to "Solid" in that case. */
    const [transparent, setTransparent] = useState<boolean>(true);

    const formatSupportsAlpha = supportsTransparency(format);
    const formatIsLossless = isLossless(format);
    /* Effective transparency the exporter will actually use — never
       diverges from the visible segmented value because the segment is
       locked to "Solid" when the format can't store alpha. */
    const effectiveTransparent = formatSupportsAlpha && transparent;

    /* ── Cached result + view state ─────────────────────────────── */

    const cachedResult = useLastExport("photo");
    const [view, setView] = useState<View>("form");
    const [progress, setProgress] = useState<ExportProgress | null>(null);
    const [error, setError] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);

    /* Reset to a known state every time the dialog opens. The cached
       result is intentionally preserved across opens — the user opts
       into seeing it via the "View last export" button. */
    useEffect(() => {
        if (!open) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setView("form");
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setProgress(null);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError(null);
    }, [open]);

    /* Re-sync the suggested filename when a new image loads while the
       dialog is closed — opening the dialog should reflect the new
       source, not a name the user typed against a previous file. */
    useEffect(() => {
        if (!open) setCustomFileName(null);
    }, [open, image?.fileName]);

    /* Focus the filename field when the form is the current view. */
    useEffect(() => {
        if (open && view === "form") inputRef.current?.focus();
    }, [open, view]);

    /* ── Handlers ───────────────────────────────────────────────── */

    /* "Adjust settings" — flip back to the form, keep the cached
       result so the user can return via "View last export". Form
       inputs (filename / format / quality) persist across this. */
    const handleReset = useCallback(() => {
        setView("form");
        setProgress(null);
        setError(null);
    }, []);

    /* "View last export" — surface the cached render without
       re-rendering. */
    const handleShowLastExport = useCallback(() => {
        setView("result");
        setProgress(null);
        setError(null);
    }, []);

    const handleClose = useCallback(() => {
        setProgress(null);
        setError(null);
        onClose();
    }, [onClose]);

    async function handleExport(e: React.FormEvent) {
        e.preventDefault();
        if (!image) return;
        setError(null);
        setView("progress");
        setProgress({ pct: 5, message: "Encoding…" });
        try {
            const blob = await exportImage(image, format, {
                /* Quality is ignored by the encoder for lossless
                   formats — passing it through anyway keeps the call
                   shape uniform. */
                quality: quality / 100,
                transparent: effectiveTransparent,
            });
            setProgress({ pct: 100, message: "Done" });
            /* Writing to the cache automatically revokes the previous
               blob URL (see `last-export.ts`), so we never accumulate
               stale blobs across repeated exports. */
            setLastExport("photo", {
                url: URL.createObjectURL(blob),
                size: blob.size,
                ext: extensionFor(format),
            });
            setView("result");
            setProgress(null);
        } catch (err) {
            console.error("PhotoExportDialog: export failed", err);
            setError(err instanceof Error ? err.message : String(err));
            setView("form");
            setProgress(null);
        }
    }

    /* ── Render ─────────────────────────────────────────────────── */

    /* The shell renders the result panel when `result` is non-null;
       hand it null when our view isn't on the result so it falls back
       to the form / progress body. */
    const shellResult = view === "result" ? cachedResult : null;

    return (
        <ExportDialogShell
            open={open}
            onClose={handleClose}
            title="Export Photo"
            progress={view === "progress" ? progress : null}
            result={shellResult}
            renderPreview={(r) => (
                <img
                    src={r.url}
                    alt="Exported photo preview"
                    style={{
                        width: "100%",
                        borderRadius: 8,
                        background: "#000",
                    }}
                />
            )}
            downloadFileName={fileName}
            onSubmit={handleExport}
            onReset={handleReset}
            onShowLastExport={cachedResult ? handleShowLastExport : undefined}
            error={error}
        >
            <FormRow label="File Name">
                <FileNameInput
                    value={fileName}
                    onChange={setCustomFileName}
                    inputRef={inputRef}
                    ext={extensionFor(format)}
                />
            </FormRow>

            <FormDivider />

            <FormRow label="Format">
                <SegmentedControl<ExportFormat>
                    options={FORMAT_OPTIONS}
                    value={format}
                    onChange={setFormat}
                />
            </FormRow>

            <FormRow label="Transparency">
                <SegmentedControl<"yes" | "no">
                    options={TRANSPARENCY_OPTIONS}
                    value={effectiveTransparent ? "yes" : "no"}
                    onChange={(v) => setTransparent(v === "yes")}
                    disabled={!formatSupportsAlpha}
                />
            </FormRow>

            {/* Quality only renders for the lossy formats — PNG ignores
                any encoder quality hint, so a slider there would be a
                no-op control. Conditional render (rather than disable)
                keeps the dialog tight when there's nothing to adjust. */}
            {!formatIsLossless && (
                <FormRow label="Quality">
                    <QualitySlider value={quality} onChange={setQuality} />
                </FormRow>
            )}
        </ExportDialogShell>
    );
}

/* ── Quality slider ───────────────────────────────────────────────── */

/**
 * 1–100 quality slider with a live numeric readout. Higher number =
 * better image, less compression, larger file — the convention every
 * major image exporter (Photoshop, GIMP, browsers) uses; reversing it
 * would confuse repeat users.
 *
 * The dialog only renders this row for lossy formats, so the
 * disabled / "PNG is lossless" affordance lives at the caller. Keeping
 * this component purely interactive simplifies the state model.
 */
function QualitySlider({
    value,
    onChange,
}: {
    value: number;
    onChange: (v: number) => void;
}) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
            }}
        >
            <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                aria-label="Quality"
                title="Quality"
                style={{
                    flex: 1,
                    height: 4,
                    accentColor: "#fff",
                    cursor: "pointer",
                }}
            />
            <span
                style={{
                    minWidth: 38,
                    textAlign: "right",
                    fontSize: 12,
                    fontVariantNumeric: "tabular-nums",
                    color: "rgba(255,255,255,0.75)",
                }}
            >
                {value}
            </span>
        </div>
    );
}
