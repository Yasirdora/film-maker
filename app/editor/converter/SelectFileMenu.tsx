"use client";

import { useEffect, useRef, useState } from "react";

type Tone = "primary" | "secondary";

export interface SelectFileMenuProps {
  /** Visible button label, e.g. "Select File" or "Add files". */
  label: string;
  /** Optional decorative leading icon. Omit for a label-only main button. */
  leadingIcon?: "plus" | "upload";
  /** Solid CTA (primary) or muted pill (secondary). */
  tone?: Tone;
  /** Disable the trigger and the menu. */
  disabled?: boolean;
  /** Triggered when the user clicks the main button (the label half). */
  onPickFromComputer: () => void;
  /**
   * Triggered when the user submits a URL. Should resolve when the file is
   * added (or has failed); the form shows a busy state until resolution.
   * Throwing renders the message inline.
   */
  onSubmitUrl: (url: string) => Promise<void>;
}

/**
 * Split CTA that morphs into a URL input field when the toggle is clicked.
 *
 * - Collapsed: [ icon + label | + ]   (left half opens the file picker, the
 *   plus on the right toggles into URL mode)
 * - Expanded: [ URL input | Add | × ] where the × is the same plus icon
 *   rotated 45°. Clicking it (or pressing Esc, or clicking outside) reverts.
 */
export default function SelectFileMenu({
  label,
  leadingIcon,
  tone = "primary",
  disabled = false,
  onPickFromComputer,
  onSubmitUrl,
}: SelectFileMenuProps) {
  const [expanded, setExpanded] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Click-outside + Escape revert.
  useEffect(() => {
    if (!expanded) return;
    function onDocPointer(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        collapse();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        collapse();
      }
    }
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  // Auto-focus the URL input when we expand.
  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  function collapse() {
    if (busy) return;
    setExpanded(false);
    setUrl("");
    setError(null);
  }

  async function submitUrl() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmitUrl(trimmed);
      setUrl("");
      setExpanded(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't add that URL.",
      );
    } finally {
      setBusy(false);
    }
  }

  const surface =
    tone === "primary"
      ? {
          background: "#9fa0a4",
          color: "#000000",
          divider: "rgba(0, 0, 0, 0.28)",
          placeholder: "rgba(0, 0, 0, 0.55)",
        }
      : {
          background: "#1c1c1f",
          color: "#e4e4e7",
          divider: "rgba(255, 255, 255, 0.16)",
          placeholder: "rgba(228, 228, 231, 0.45)",
        };

  return (
    <div ref={containerRef} className="relative inline-flex">
      <div
        className="no-focus-ring inline-flex items-stretch rounded-md overflow-hidden"
        style={{
          backgroundColor: surface.background,
          color: surface.color,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {expanded ? (
          <>
            <input
              ref={inputRef}
              type="url"
              inputMode="url"
              placeholder="Paste a direct file URL"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitUrl();
                }
              }}
              disabled={busy}
              required
              aria-label="File URL"
              className="bg-transparent outline-none text-[14px] sm:text-[16px] font-normal pl-5 sm:pl-7 pr-3 py-[12px] sm:py-[13px] w-[220px] sm:w-[320px] disabled:cursor-not-allowed"
              style={
                {
                  color: surface.color,
                  ["--placeholder-color" as string]: surface.placeholder,
                } as React.CSSProperties
              }
            />
            <span
              aria-hidden
              className="self-center w-px h-3.5 sm:h-4"
              style={{ backgroundColor: surface.divider }}
            />
            <button
              type="button"
              onClick={submitUrl}
              disabled={busy || url.trim().length === 0}
              aria-label={busy ? "Adding URL…" : "Add URL"}
              className="inline-flex items-center justify-center px-3.5 sm:px-4 py-[12px] sm:py-[13px] hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? <SpinnerGlyph /> : <CheckGlyph />}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (disabled) return;
              onPickFromComputer();
            }}
            disabled={disabled}
            className="inline-flex items-center gap-2 text-[14px] sm:text-[16px] font-semibold pl-5 sm:pl-7 pr-3.5 sm:pr-4 py-[12px] sm:py-[13px] hover:brightness-110 transition disabled:cursor-not-allowed"
          >
            {leadingIcon && <LeadingGlyph kind={leadingIcon} />}
            {label}
          </button>
        )}

        <span
          aria-hidden
          className="self-center w-px h-3.5 sm:h-4"
          style={{ backgroundColor: surface.divider }}
        />

        {/* Toggle: same DOM node across both states; the plus rotates 45° to
            become an X when expanded, with a smooth transition. */}
        <button
          type="button"
          onClick={() => {
            if (disabled || busy) return;
            if (expanded) collapse();
            else {
              setError(null);
              setExpanded(true);
            }
          }}
          disabled={disabled || busy}
          aria-haspopup="dialog"
          aria-expanded={expanded}
          aria-label={expanded ? "Cancel" : "Add file from URL"}
          className="inline-flex items-center justify-center px-3 sm:px-3.5 hover:brightness-110 transition disabled:cursor-not-allowed"
        >
          <span
            className={`inline-flex transition-transform duration-200 ease-out ${
              expanded ? "rotate-45" : "rotate-0"
            }`}
            aria-hidden
          >
            <PlusGlyph className="w-[17px] h-[17px]" />
          </span>
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="absolute left-0 right-0 top-full mt-1.5 text-[12px] text-[#ff6b6b] leading-snug"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function LeadingGlyph({ kind }: { kind: "plus" | "upload" }) {
  if (kind === "upload") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    );
  }
  return <PlusGlyph className="w-4 h-4" />;
}

function PlusGlyph({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[17px] h-[17px]"
    >
      <polyline points="5 12 10 17 19 7" />
    </svg>
  );
}

function SpinnerGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      className="w-[17px] h-[17px] animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.4-8.6" opacity={0.85} />
    </svg>
  );
}
