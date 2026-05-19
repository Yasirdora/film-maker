"use client";

/**
 * PhotoEditor page-bar actions — file open + export trigger.
 *
 *   • `PhotoFileOpenButton` — kebab-style "Open…" trigger that mounts
 *     a hidden file `<input>` and forwards the chosen file to the
 *     parent. When an image is already loaded the label switches to
 *     "Replace…", matching the user's mental model — a second open
 *     replaces, never opens a second editor.
 *
 *   • `PhotoExportButton` — primary "Export" pill that opens the
 *     `<PhotoExportDialog>`. Format / quality / filename live in the
 *     dialog, mirroring the video and audio editors.
 *
 * State (loaded image, dialog open) lives in `PhotoEditorMount`;
 * these components are deliberately presentational so they remain
 * easy to mount under any chrome (PageBar today, a future toolbar
 * tomorrow).
 */

import { useCallback, useRef } from "react";

/* ── File open ────────────────────────────────────────────────────── */

const FILE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp";

export function PhotoFileOpenButton({
    hasImage,
    onFile,
    disabled,
}: {
    hasImage: boolean;
    onFile: (file: File) => void;
    disabled?: boolean;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    const openPicker = useCallback(() => {
        inputRef.current?.click();
    }, []);

    const onChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            /* Reset so re-picking the same file fires `change` again. */
            e.target.value = "";
            if (file) onFile(file);
        },
        [onFile],
    );

    return (
        <div className="ml-2 sm:ml-3 inline-flex items-center">
            <input
                ref={inputRef}
                type="file"
                accept={FILE_ACCEPT}
                onChange={onChange}
                style={{ display: "none" }}
                aria-hidden
            />
            <button
                type="button"
                onClick={openPicker}
                disabled={disabled}
                aria-label={hasImage ? "Replace image" : "Open image"}
                title={hasImage ? "Replace image" : "Open image (drag & drop also works)"}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium text-white/80 hover:text-white hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                <FolderGlyph />
                <span>{hasImage ? "Replace" : "Open"}</span>
            </button>
        </div>
    );
}

/* ── Export ───────────────────────────────────────────────────────── */

/**
 * Single primary action that opens the export dialog. Parallels the
 * video / audio editors' Export buttons one-to-one — same shape, same
 * disabled affordance, same surface. The dialog owns format / quality
 * / filename, so this button only needs to know whether an image is
 * loaded and how to flip the dialog open.
 */
export function PhotoExportButton({
    hasImage,
    onClick,
}: {
    hasImage: boolean;
    onClick: () => void;
}) {
    const disabled = !hasImage;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label="Export"
            title={disabled ? "Open an image to enable export" : "Export"}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-[12px] font-semibold text-black bg-white hover:bg-white/90 disabled:bg-white/15 disabled:text-white/40 disabled:cursor-not-allowed transition-colors"
        >
            <DownloadGlyph />
            <span>Export</span>
        </button>
    );
}

/* ── Glyphs ──────────────────────────────────────────────────────── */

function FolderGlyph() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        </svg>
    );
}

function DownloadGlyph() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
    );
}

