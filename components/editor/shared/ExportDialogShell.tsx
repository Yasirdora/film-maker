"use client";

/**
 * ExportDialogShell — chromeless modal frame and a small set of form atoms
 * (FormRow, SegmentedControl, SelectControl, DialogBtn) plus a progress
 * panel and result panel. Editors compose these into their own ExportDialog
 * with format-specific options; the shell handles backdrop/Escape/animation
 * so each dialog stays focused on the format-specific UI.
 *
 * The shell is intentionally headless about WHAT you're exporting — it
 * doesn't know about audio formats or video presets, only about the modal
 * lifecycle and the visual primitives the form is built from.
 */

import { useEffect, type FormEvent, type ReactNode } from "react";
import { fmtSize } from "@/lib/editor/media";

export type ExportProgress = {
  /** 0–100; pass -1 to render an indeterminate "—". */
  pct: number;
  message: string;
};

export type ExportResult = {
  /** Object-URL for the rendered blob. The shell does NOT revoke it; the
   *  caller owns the URL lifetime so it can re-use it across re-opens. */
  url: string;
  size: number;
  /** File extension WITHOUT the leading dot (e.g. "mp3", "mp4"). */
  ext: string;
};

export type ExportDialogShellProps = {
  open: boolean;
  onClose: () => void;
  /** Header label, e.g. "Export Audio" / "Export Video". */
  title: string;
  /** Live progress; non-null disables Cancel and the close affordance. */
  progress: ExportProgress | null;
  /** Final result; mutually exclusive with `progress`. When set, the form is
   *  replaced by an inline preview + download link. */
  result: ExportResult | null;
  /** When provided, the result panel renders this preview node above the
   *  download link. Audio passes an <audio>; video passes a <video>. */
  renderPreview?: (result: ExportResult) => ReactNode;
  /** Filename (without extension) used for the download `download=` attr. */
  downloadFileName: string;
  /** Submit handler for the form. The shell wraps `<form onSubmit={...}>`. */
  onSubmit: (e: FormEvent) => void;
  /** The form body itself — FormRow + SegmentedControl + SelectControl etc. */
  children: ReactNode;
  /** Optional inline error shown above the footer. */
  error?: string | null;
  /**
   * Optional callback that returns the dialog to its form state without
   * closing it — used to power an "Export again" affordance after a
   * successful render. The consumer is responsible for clearing its own
   * `result` / `progress` / `error` state (and revoking the blob URL if
   * it should not survive the next export). Form inputs (filename,
   * resolution, quality) are kept so the user can tweak and re-export.
   */
  onReset?: () => void;
};

export default function ExportDialogShell({
  open,
  onClose,
  title,
  progress,
  result,
  renderPreview,
  downloadFileName,
  onSubmit,
  children,
  error,
  onReset,
}: ExportDialogShellProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !progress) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, progress]);

  if (!open) return null;

  const formIdle = !progress && !result;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 2000,
        padding: 20,
      }}
      onClick={() => !progress && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        noValidate
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#141414",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "#fff",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 13,
          animation: "ae-modal-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <style>{`
          @keyframes ae-modal-in {
            from { opacity: 0; transform: scale(0.96) translateY(8px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        <ShellHeader title={title} onClose={onClose} disabled={!!progress} />

        {progress && <ProgressPanel progress={progress} />}

        {result && !progress && renderPreview && (
          <ResultPanel
            result={result}
            renderPreview={renderPreview}
            downloadFileName={downloadFileName}
            onClose={onClose}
          />
        )}

        {formIdle && (
          <div style={{ padding: "20px 20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            {children}
            {error && (
              <div style={{ color: "#ff453a", fontSize: 12, lineHeight: 1.4, padding: "0 4px" }}>
                {error}
              </div>
            )}
          </div>
        )}

        <ShellFooter
          formIdle={formIdle}
          showResult={!!result && !progress}
          onClose={onClose}
          onReset={onReset}
        />
      </form>
    </div>
  );
}

/* ── Shell pieces ────────────────────────────────────────────────────── */

function ShellHeader({
  title,
  onClose,
  disabled,
}: {
  title: string;
  onClose: () => void;
  disabled: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>
        {title}
      </h2>
      <button
        type="button"
        onClick={onClose}
        disabled={disabled}
        aria-label="Close"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          border: "none",
          background: "transparent",
          color: "rgba(255,255,255,0.4)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)";
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function ProgressPanel({ progress }: { progress: ExportProgress }) {
  return (
    <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{progress.message}</div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.max(0, Math.min(100, progress.pct))}%`,
            background: "#fff",
            borderRadius: 3,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <div
        style={{
          color: "rgba(255,255,255,0.4)",
          fontSize: 12,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {progress.pct >= 0 ? `${progress.pct.toFixed(0)}%` : "—"}
      </div>
    </div>
  );
}

function ResultPanel({
  result,
  renderPreview,
  downloadFileName,
  onClose,
}: {
  result: ExportResult;
  renderPreview: (r: ExportResult) => ReactNode;
  downloadFileName: string;
  onClose: () => void;
}) {
  return (
    <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
        Export complete — {fmtSize(result.size)}
      </div>
      {renderPreview(result)}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <a
          href={result.url}
          download={`${downloadFileName}.${result.ext}`}
          onClick={onClose}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 32,
            padding: "0 16px",
            borderRadius: 8,
            border: "none",
            background: "#fff",
            color: "#000",
            fontSize: 12,
            fontWeight: 600,
            textDecoration: "none",
            cursor: "pointer",
            transition: "opacity 0.15s",
          }}
        >
          Download
        </a>
      </div>
    </div>
  );
}

function ShellFooter({
  formIdle,
  showResult,
  onClose,
  onReset,
}: {
  formIdle: boolean;
  showResult: boolean;
  onClose: () => void;
  /** When provided in the result state, exposes an "Adjust settings"
   *  action that drops the user back to the form so they can tweak
   *  resolution / quality / filename and render again. */
  onReset?: () => void;
}) {
  /* During progress the footer is hidden entirely. In the result state
     it is only useful when there is an "Adjust settings" affordance to
     surface — dismissal already lives in the header X / backdrop /
     Escape, so a redundant "Close" button here would just dilute the
     primary action. */
  if (!formIdle && !showResult) return null;
  if (showResult && !onReset) return null;
  return (
    <div
      style={{
        padding: "14px 20px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
      }}
    >
      {formIdle ? (
        <>
          <DialogBtn variant="secondary" onClick={onClose}>Cancel</DialogBtn>
          <DialogBtn variant="primary" type="submit">Export</DialogBtn>
        </>
      ) : (
        /* `onReset` is guaranteed to be defined here by the early-return
           above; non-null assertion would clutter the JSX, so just call
           through and let TypeScript narrow via the conditional render. */
        onReset && (
          <DialogBtn variant="primary" onClick={onReset}>
            Adjust settings
          </DialogBtn>
        )
      )}
    </div>
  );
}

/* ── Form atoms (also exported so editors can compose richer forms) ──── */

export function FormRow({
  label,
  children,
  disabled,
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        opacity: disabled ? 0.35 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <div
        style={{
          width: 72,
          textAlign: "right",
          color: "rgba(255,255,255,0.5)",
          fontSize: 12,
          fontWeight: 500,
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

export function FormDivider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        background: "rgba(255,255,255,0.04)",
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              height: 30,
              borderRadius: 8,
              border: "none",
              background: selected ? "rgba(255,255,255,0.12)" : "transparent",
              color: selected ? "#fff" : "rgba(255,255,255,0.5)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              if (!selected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              if (!selected) (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function SelectControl({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        width: "100%",
        height: 36,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        color: "#fff",
        fontSize: 13,
        fontFamily: "inherit",
        padding: "0 32px 0 12px",
        outline: "none",
        cursor: "pointer",
        appearance: "none",
        WebkitAppearance: "none",
        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        transition: "border-color 0.15s",
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function DialogBtn({
  children,
  variant,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  variant: "primary" | "secondary";
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        height: 32,
        padding: "0 18px",
        borderRadius: 8,
        border: "none",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s",
        background: isPrimary ? "#fff" : "rgba(255,255,255,0.08)",
        color: isPrimary ? "#000" : "rgba(255,255,255,0.85)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = isPrimary
          ? "rgba(255,255,255,0.9)"
          : "rgba(255,255,255,0.12)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = isPrimary
          ? "#fff"
          : "rgba(255,255,255,0.08)";
      }}
    >
      {children}
    </button>
  );
}

/* Filename + extension input — used by both audio/video for consistency. */
export function FileNameInput({
  value,
  onChange,
  inputRef,
  ext,
}: {
  value: string;
  onChange: (next: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Extension WITHOUT the leading dot. */
  ext: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        padding: "0 12px",
        height: 36,
        transition: "border-color 0.15s",
      }}
      onClick={() => inputRef?.current?.focus()}
    >
      <input
        type="text"
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck="false"
        autoComplete="off"
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: "none",
          color: "#fff",
          fontSize: 13,
          padding: 0,
          outline: "none",
          fontFamily: "inherit",
        }}
      />
      <span
        style={{
          color: "rgba(255,255,255,0.3)",
          fontSize: 12,
          fontFamily: "monospace",
          paddingLeft: 4,
          userSelect: "none",
        }}
      >
        .{ext}
      </span>
    </div>
  );
}
