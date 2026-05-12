"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CategoryConfig,
  ScopedCategory,
  defaultOutputFor,
  detectCategory,
  extensionOf,
  formatBytes,
  formatsFor,
} from "./config";
import { ConversionResult, convertFile, fetchUrlAsFile } from "./conversion";
import Lightbox, { LightboxItem } from "./Lightbox";
import SelectFileMenu from "./SelectFileMenu";
import PageBar, { type BreadcrumbItem } from "@/components/editor/PageBar";

const MAX_FILES = 10;

type ItemStatus = "idle" | "converting" | "done" | "error";

type Item = {
  id: string;
  file: File;
  category: ScopedCategory;
  format: string;
  previewUrl?: string;
  status: ItemStatus;
  /** Last reported progress in [0, 1]. Only meaningful while `status === "converting"`. */
  progress: number;
  /** Conversion output. Set when `status === "done"`. */
  result?: ConversionResult;
  /** Error message. Set when `status === "error"`. */
  error?: string;
};

export default function ConverterView({ config }: { config: CategoryConfig }) {
  const [items, setItems] = useState<Item[]>([]);
  const [outputFormat, setOutputFormat] = useState(config.defaultOutput);
  const [outputOpen, setOutputOpen] = useState(false);
  const [inputFormat, setInputFormat] = useState("Auto detect");
  const [inputOpen, setInputOpen] = useState(false);
  const [perFileMenuId, setPerFileMenuId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [skippedNotice, setSkippedNotice] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);

  const outputMenuRef = useRef<HTMLDivElement>(null);
  const inputMenuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (outputMenuRef.current && !outputMenuRef.current.contains(target)) {
        setOutputOpen(false);
      }
      if (inputMenuRef.current && !inputMenuRef.current.contains(target)) {
        setInputOpen(false);
      }
      if (listRef.current && !listRef.current.contains(target)) {
        setPerFileMenuId(null);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Revoke any remaining object URLs on unmount
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => {
        if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
        if (it.result?.url) URL.revokeObjectURL(it.result.url);
      });
    };
  }, []);

  // Document-level paste handler: catches screenshots / copied images and
  // pasted URLs anywhere on the converter page. Skipped when the user is
  // pasting into a real form field (e.g. the URL input inside the menu).
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      const data = e.clipboardData;
      if (!data) return;

      // 1. Direct files (screenshot tools, "Copy image" from the OS, etc.)
      const files: File[] = [];
      for (const item of Array.from(data.items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        handleFiles(files);
        return;
      }

      // 2. URL text — fetch via the proxy.
      const text = data.getData("text/plain")?.trim();
      if (text && /^https?:\/\/\S+/i.test(text)) {
        e.preventDefault();
        handleAddByUrl(text).catch((err) => {
          setSkippedNotice(
            err instanceof Error ? err.message : "Couldn't add that URL.",
          );
        });
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // handleFiles / handleAddByUrl close over current state via refs and
    // setState, so leaving deps empty is intentional — re-binding the
    // listener on every state tick would be wasteful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss skipped-files notice
  useEffect(() => {
    if (!skippedNotice) return;
    const t = setTimeout(() => setSkippedNotice(null), 4000);
    return () => clearTimeout(t);
  }, [skippedNotice]);

  function handleFiles(input: FileList | File[] | null) {
    if (!input) return;
    const files = Array.isArray(input) ? input : Array.from(input);
    if (files.length === 0) return;

    type Pending = { file: File; category: ScopedCategory };
    const pending: Pending[] = [];
    const skippedNames: string[] = [];

    for (const file of files) {
      const category = detectCategory(file);
      if (category === null) {
        skippedNames.push(file.name);
        continue;
      }
      if (!config.isUniversal && category !== config.category) {
        skippedNames.push(file.name);
        continue;
      }
      pending.push({ file, category });
    }

    if (skippedNames.length > 0) {
      const noun = config.isUniversal
        ? "supported"
        : `${config.category}${skippedNames.length > 1 ? "s" : ""}`;
      setSkippedNotice(
        skippedNames.length === 1
          ? `“${skippedNames[0]}” isn't ${
              config.isUniversal ? "supported" : `a ${config.category}`
            } — skipped.`
          : `${skippedNames.length} files weren't ${noun} — skipped.`,
      );
    }

    if (pending.length === 0) return;

    // Cap the total number of files at MAX_FILES.
    const remaining = Math.max(0, MAX_FILES - itemsRef.current.length);
    if (remaining === 0) {
      setSkippedNotice(
        `Maximum ${MAX_FILES} files. Remove one to add another.`,
      );
      return;
    }
    let toAccept = pending;
    if (pending.length > remaining) {
      const overflow = pending.length - remaining;
      toAccept = pending.slice(0, remaining);
      setSkippedNotice(
        overflow === 1
          ? `Maximum ${MAX_FILES} files — 1 file skipped.`
          : `Maximum ${MAX_FILES} files — ${overflow} files skipped.`,
      );
    }

    setItems((prev) => {
      const next: Item[] = toAccept.map(({ file, category }) => {
        const format = config.isUniversal
          ? defaultOutputFor(category)
          : outputFormat;
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          category,
          format,
          previewUrl: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined,
          status: "idle",
          progress: 0,
        };
      });
      return [...prev, ...next];
    });
  }

  /**
   * Fetches a remote URL via the server-side proxy and adds the resulting
   * file to the list. Throws on failure so the SelectFileMenu can display
   * the error inline.
   */
  async function handleAddByUrl(url: string) {
    if (itemsRef.current.length >= MAX_FILES) {
      throw new Error(`Maximum ${MAX_FILES} files. Remove one to add another.`);
    }
    const file = await fetchUrlAsFile(url);
    handleFiles([file]);
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target?.result?.url) URL.revokeObjectURL(target.result.url);
      return prev.filter((it) => it.id !== id);
    });
  }

  /** Patches a single item, identified by id. No-op if the id is gone. */
  function updateItem(id: string, partial: Partial<Item>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...partial } : it)),
    );
  }

  function setItemFormat(id: string, fmt: string) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        // Picking a different output format invalidates any prior conversion
        // for this row — drop the result and reset back to idle.
        if (it.format === fmt) return it;
        if (it.result?.url) URL.revokeObjectURL(it.result.url);
        return {
          ...it,
          format: fmt,
          status: "idle",
          progress: 0,
          result: undefined,
          error: undefined,
        };
      }),
    );
    setPerFileMenuId(null);
  }

  function pickGlobalOutput(fmt: string) {
    setOutputFormat(fmt);
    setOutputOpen(false);
    // On scoped pages, the global Output is also a one-click "set all" shortcut.
    if (!config.isUniversal && items.length > 0) {
      setItems((prev) =>
        prev.map((it) => {
          if (it.format === fmt) return it;
          if (it.result?.url) URL.revokeObjectURL(it.result.url);
          return {
            ...it,
            format: fmt,
            status: "idle",
            progress: 0,
            result: undefined,
            error: undefined,
          };
        }),
      );
    }
  }

  /** Converts every item still in the `idle` state, in sequence. */
  async function handleConvert() {
    if (isConverting) return;

    const targets = itemsRef.current.filter((it) => it.status === "idle");
    if (targets.length === 0) return;

    setIsConverting(true);
    try {
      for (const target of targets) {
        // The user may have removed the row, or changed its format (which
        // resets it to idle again — still fine to convert). Re-read state.
        const current = itemsRef.current.find((it) => it.id === target.id);
        if (!current || current.status !== "idle") continue;

        updateItem(target.id, { status: "converting", progress: 0 });
        try {
          const result = await convertFile(
            current.file,
            current.category,
            current.format,
            (ratio) => {
              // Ignore progress callbacks for items that are no longer pending
              // (e.g. user removed the row mid-conversion).
              const live = itemsRef.current.find((it) => it.id === target.id);
              if (!live || live.status !== "converting") return;
              updateItem(target.id, { progress: ratio });
            },
          );

          // If the row was removed while we were awaiting the result, throw
          // away the converted blob to avoid leaking the object URL.
          const stillPresent = itemsRef.current.some(
            (it) => it.id === target.id,
          );
          if (!stillPresent) {
            URL.revokeObjectURL(result.url);
            continue;
          }
          updateItem(target.id, { status: "done", progress: 1, result });
        } catch (err) {
          const stillPresent = itemsRef.current.some(
            (it) => it.id === target.id,
          );
          if (!stillPresent) continue;
          updateItem(target.id, {
            status: "error",
            progress: 0,
            error:
              err instanceof Error ? err.message : "Conversion failed.",
          });
        }
      }
    } finally {
      setIsConverting(false);
    }
  }

  // Breadcrumb trail for the per-page bar. Universal sits one level deep,
  // scoped converters two levels deep under "Media Converter".
  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const trail: BreadcrumbItem[] = [{ label: "Home", href: "/editor" }];
    if (config.isUniversal) {
      trail.push({ label: "Media Converter" });
    } else {
      trail.push({ label: "Media Converter", href: "/editor/converter" });
      trail.push({ label: config.title.replace(/\s*Converter$/i, "") });
    }
    return trail;
  }, [config]);

  // Items eligible for the lightbox — completed conversions with a result.
  const previewableItems = useMemo<LightboxItem[]>(
    () =>
      items
        .filter((it): it is Item & { result: ConversionResult } =>
          it.status === "done" && !!it.result,
        )
        .map((it) => ({
          id: it.id,
          url: it.result.url,
          filename: it.result.filename,
          size: it.result.blob.size,
          category: it.category,
          format: it.format,
        })),
    [items],
  );

  const previewIndex = previewItemId
    ? previewableItems.findIndex((it) => it.id === previewItemId)
    : -1;

  // Auto-close the preview if its target item is removed elsewhere.
  useEffect(() => {
    if (previewItemId && previewIndex < 0) {
      setPreviewItemId(null);
    }
  }, [previewItemId, previewIndex]);

  // Single source of truth for the primary action button on the right of
  // the controls bar. Walks the item statuses to pick a label + handler.
  const primaryAction = useMemo<{
    label: string;
    onClick: () => void;
    disabled: boolean;
  }>(() => {
    const total = items.length;
    if (total === 0) {
      return {
        label: "Convert",
        onClick: () => {},
        disabled: true,
      };
    }
    if (isConverting) {
      return {
        label: "Converting…",
        onClick: () => {},
        disabled: true,
      };
    }
    const allDone = items.every((it) => it.status === "done");
    if (allDone) {
      return {
        label: total > 1 ? "Download all" : "Download",
        onClick: handleDownloadAll,
        disabled: false,
      };
    }
    const hasIdle = items.some((it) => it.status === "idle");
    return {
      label: total > 1 ? "Convert all" : "Convert",
      onClick: handleConvert,
      disabled: !hasIdle,
    };
    // handleConvert and handleDownloadAll are stable across renders by virtue
    // of closing over refs/setState — listing them here would force unneeded
    // rebuilds, so we trust the lint-disable below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, isConverting]);

  /**
   * Triggers a sequential download for every completed file. We stagger the
   * clicks because some browsers suppress rapid programmatic downloads.
   */
  function handleDownloadAll() {
    const completed = itemsRef.current.filter(
      (it) => it.status === "done" && it.result,
    );
    completed.forEach((it, i) => {
      window.setTimeout(() => {
        const a = document.createElement("a");
        a.href = it.result!.url;
        a.download = it.result!.filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 250);
    });
  }

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{
        backgroundColor: "#050505",
        color: "#ffffff",
      }}
    >
      {/* Dotted background */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, rgba(255,255,255,0.05) 1.5px, transparent 1.5px)",
          backgroundSize: "40px 40px",
          zIndex: 0,
        }}
      />

      <div className="relative z-10 flex flex-col flex-1">
        <PageBar breadcrumbs={breadcrumbs} />

        {/* Main */}
        <main className="flex-1 flex flex-col items-center pt-4 sm:pt-12 sm:px-4">
          {/* Widget */}
          <div
            className="w-full max-w-[1300px] p-3 sm:p-4 border-y sm:border sm:rounded-[20px] sm:min-h-[420px] flex flex-col"
            style={{
              backgroundColor: "#09090b",
              borderColor: "#1f1f22",
            }}
          >
            {items.length === 0 && (
              <div className="text-center px-4 pt-6 sm:pt-10 pb-4 sm:pb-8">
                <h1 className="text-[36px] sm:text-[56px] font-bold tracking-[-0.02em] mb-3 text-white leading-[1.05]">
                  {config.title}
                </h1>
                <p className="text-[14px] sm:text-[16px] text-[#8e8e93] leading-[1.5] font-normal max-w-2xl mx-auto">
                  {config.subtitle}
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={config.acceptAttribute}
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {skippedNotice && (
              <div
                role="status"
                className="mb-3 rounded-lg px-3 py-2 text-[13px] text-[#e4e4e7]"
                style={{
                  backgroundColor: "#1c1c1f",
                  border: "1px solid #2a2a2e",
                }}
              >
                {skippedNotice}
              </div>
            )}

            {items.length === 0 ? (
              /* Dropzone — drag-drop only; the inner button is the explicit
                 click target so the outer container doesn't need to be a
                 button itself. */
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  handleFiles(e.dataTransfer.files);
                }}
                className="rounded-xl px-6 py-12 sm:py-20 flex flex-col items-center justify-center gap-5 sm:gap-7 transition-colors text-center"
                style={{
                  backgroundColor: dragActive ? "#17171a" : "#121214",
                  border: `1.5px dashed ${dragActive ? "#3a3a3e" : "#2a2a2e"}`,
                }}
              >
                <SelectFileMenu
                  label="Select File"
                  tone="primary"
                  onPickFromComputer={() =>
                    fileInputRef.current?.click()
                  }
                  onSubmitUrl={handleAddByUrl}
                />
                <p className="text-[13px] sm:text-[14px] text-[#8e8e93] font-normal leading-tight">
                  <span className="sm:hidden">or tap to upload</span>
                  <span className="hidden sm:inline">Paste or drop here</span>
                </p>
              </div>
            ) : (
              /* File list */
              <div
                ref={listRef}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  handleFiles(e.dataTransfer.files);
                }}
                className="rounded-xl flex flex-col p-1"
                style={{
                  backgroundColor: dragActive ? "#17171a" : "#121214",
                  border: `1px solid ${dragActive ? "#2a2a2e" : "#1f1f22"}`,
                }}
              >
                {items.map((it, idx) => (
                  <div key={it.id}>
                    {idx > 0 && (
                      <div
                        className="h-px bg-white/[0.04] mx-3.5"
                        aria-hidden
                      />
                    )}
                    <FileRow
                      item={it}
                      isMenuOpen={perFileMenuId === it.id}
                      onToggleMenu={() =>
                        setPerFileMenuId((cur) =>
                          cur === it.id ? null : it.id
                        )
                      }
                      onPickFormat={(fmt) => setItemFormat(it.id, fmt)}
                      onRemove={() => removeItem(it.id)}
                      onPreview={() => setPreviewItemId(it.id)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Controls */}
            <div className="flex justify-between items-center mt-auto pt-4 flex-wrap gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                {items.length === 0 ? (
                  config.isUniversal ? (
                    <ReadOnlyPill label="Input" value="Auto detect" />
                  ) : (
                    <>
                      <FormatSelect
                        ref={inputMenuRef}
                        label="Input"
                        value={inputFormat}
                        options={config.inputFormats}
                        open={inputOpen}
                        renderValue={(v) =>
                          v === "Auto detect" ? (
                            <>
                              <span className="sm:hidden">Auto</span>
                              <span className="hidden sm:inline">
                                Auto detect
                              </span>
                            </>
                          ) : (
                            v
                          )
                        }
                        onToggle={() => setInputOpen((v) => !v)}
                        onPick={(f) => {
                          setInputFormat(f);
                          setInputOpen(false);
                        }}
                      />
                      <FormatSelect
                        ref={outputMenuRef}
                        label="Output"
                        value={outputFormat}
                        options={config.outputFormats}
                        open={outputOpen}
                        onToggle={() => setOutputOpen((v) => !v)}
                        onPick={pickGlobalOutput}
                      />
                    </>
                  )
                ) : items.length >= MAX_FILES ? null : (
                  /* Add files dropdown — replaces empty-state pills once items exist */
                  <SelectFileMenu
                    label="Add files"
                    tone="secondary"
                    onPickFromComputer={() => fileInputRef.current?.click()}
                    onSubmitUrl={handleAddByUrl}
                  />
                )}
              </div>

              {items.length > 0 && (
                <button
                  type="button"
                  disabled={primaryAction.disabled}
                  onClick={primaryAction.onClick}
                  className="rounded-md px-8 py-[11px] text-[14px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: "#9fa0a4",
                    color: "#000000",
                  }}
                >
                  {primaryAction.label}
                </button>
              )}
            </div>
          </div>

          {items.length === 0 && (
            <p className="mt-4 sm:mt-6 px-4 text-center text-[12px] sm:text-[13px] text-[#5c5c60]">
              {dropzoneSupportLine(config)}
            </p>
          )}
        </main>

        <SiteFooter />
      </div>

      {previewIndex >= 0 && (
        <Lightbox
          items={previewableItems}
          index={previewIndex}
          onIndexChange={(idx) =>
            setPreviewItemId(previewableItems[idx]?.id ?? null)
          }
          onClose={() => setPreviewItemId(null)}
        />
      )}
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="w-full px-4 sm:px-12 py-8 sm:py-10 mt-16 sm:mt-24 flex justify-between items-center text-[13px] sm:text-[14px] text-[#8e8e93]">
      <span className="text-white font-medium">© 2026 Film-maker Network</span>
      <nav className="flex gap-5 sm:gap-8">
        <a href="#" className="hover:text-white transition-colors">
          Privacy Notice
        </a>
        <a href="#" className="hover:text-white transition-colors">
          Terms &amp; Privacy
        </a>
      </nav>
    </footer>
  );
}

function dropzoneSupportLine(config: CategoryConfig): string {
  if (config.isUniversal) return "Supports Images, Videos, and Audio.";
  switch (config.category) {
    case "image":
      return "Supports PNG, JPG, WEBP, AVIF, BMP.";
    case "video":
      return "Supports MP4, MOV, WEBM, AVI, MKV.";
    case "audio":
      return "Supports MP3, WAV, FLAC, AAC, OGG, M4A.";
    default:
      return "";
  }
}

function ReadOnlyPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center gap-2 sm:gap-3 rounded-md border border-[#1f1f22] py-1 pl-3 sm:pl-4 pr-1"
      aria-label={`${label}: ${value}`}
    >
      <span className="text-[13px] sm:text-[15px] text-[#8e8e93] font-normal">
        {label}
      </span>
      <span
        className="rounded-md text-[13px] sm:text-[15px] font-semibold px-3 py-1.5 sm:px-3.5 sm:py-[7px]"
        style={{
          backgroundColor: "#1c1c1f",
          color: "#e4e4e7",
        }}
      >
        {value}
      </span>
    </div>
  );
}

interface FormatSelectProps {
  label: string;
  value: string;
  options: readonly string[];
  open: boolean;
  onToggle: () => void;
  onPick: (f: string) => void;
  renderValue?: (v: string) => React.ReactNode;
}

const FormatSelect = function FormatSelect({
  ref,
  label,
  value,
  options,
  open,
  onToggle,
  onPick,
  renderValue,
}: FormatSelectProps & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className="relative flex items-center gap-2 sm:gap-3 rounded-md border border-[#1f1f22] py-1 pl-3 sm:pl-4 pr-1"
    >
      <span className="text-[13px] sm:text-[15px] text-[#8e8e93] font-normal">
        {label}
      </span>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 sm:gap-2 rounded-md text-[13px] sm:text-[15px] font-semibold transition-colors px-3 py-1.5 sm:px-3.5 sm:py-[7px]"
        style={{
          backgroundColor: "#1c1c1f",
          color: "#e4e4e7",
        }}
      >
        {renderValue ? renderValue(value) : value}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <FormatMenu current={value} options={options} onPick={onPick} />}
    </div>
  );
};

function FileRow({
  item,
  isMenuOpen,
  onToggleMenu,
  onPickFormat,
  onRemove,
  onPreview,
}: {
  item: Item;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onPickFormat: (fmt: string) => void;
  onRemove: () => void;
  onPreview: () => void;
}) {
  const sourceFormat = extensionOf(item.file.name);
  const options = formatsFor(item.category);
  const isConverting = item.status === "converting";
  const isDone = item.status === "done";
  const isError = item.status === "error";

  return (
    <div className="group flex items-center gap-3.5 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-white/[0.02]">
      {/* Thumbnail */}
      <div
        className="w-14 h-14 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: "#1c1c1f" }}
      >
        {item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.previewUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-[11px] font-semibold tracking-wider text-white/55">
            {sourceFormat}
          </span>
        )}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0 mr-2">
        <div className="text-[15px] font-medium text-white truncate leading-tight">
          {item.file.name}
        </div>
        <div className="text-[12.5px] mt-1 flex items-center gap-1.5 leading-none">
          {isError ? (
            <span className="text-[#ff6b6b] truncate" title={item.error}>
              {item.error ?? "Conversion failed."}
            </span>
          ) : (
            <>
              <span className="text-[#8e8e93]">
                {formatBytes(item.file.size)}
              </span>
              <span className="text-[#3a3a3e]">·</span>
              <span className="text-[#8e8e93]">{sourceFormat}</span>
              {isConverting && (
                <>
                  <span className="text-[#3a3a3e]">·</span>
                  <span className="text-[#e4e4e7] tabular-nums">
                    {Math.round(item.progress * 100)}%
                  </span>
                </>
              )}
              {isDone && (
                <>
                  <span className="text-[#3a3a3e]">·</span>
                  <span className="text-[#34d399] font-medium">Ready</span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isConverting ? (
          <ProgressBar progress={item.progress} />
        ) : isDone && item.result ? (
          <>
            <button
              type="button"
              onClick={onPreview}
              aria-label={`Preview ${item.result.filename}`}
              title="Preview"
              className="w-8 h-8 rounded-md flex items-center justify-center text-[#8e8e93] hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <EyeIcon />
            </button>
            <a
              href={item.result.url}
              download={item.result.filename}
              aria-label={`Download ${item.result.filename}`}
              title="Download"
              className="w-8 h-8 rounded-md flex items-center justify-center text-[#34d399] hover:bg-white/[0.06] transition-colors"
            >
              <DownloadIcon />
            </a>
          </>
        ) : (
          <>
            <span className="text-[13px] text-[#5c5c60] mr-0.5">to</span>
            <div className="relative">
              <button
                type="button"
                onClick={onToggleMenu}
                className="flex items-center gap-1.5 rounded-md text-[14px] font-semibold transition-colors hover:bg-white/[0.04]"
                style={{
                  backgroundColor: "transparent",
                  border: "1px solid #26262a",
                  color: "#e4e4e7",
                  padding: "6px 12px",
                }}
              >
                {item.format}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`w-3.5 h-3.5 text-[#8e8e93] transition-transform ${
                    isMenuOpen ? "rotate-180" : ""
                  }`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {isMenuOpen && (
                <FormatMenu
                  current={item.format}
                  options={options}
                  onPick={onPickFormat}
                  align="right"
                />
              )}
            </div>

            <button
              type="button"
              aria-label="Settings"
              className="w-8 h-8 rounded-md flex items-center justify-center text-[#5c5c60] hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <GearIcon />
            </button>
          </>
        )}

        <button
          type="button"
          aria-label="Remove"
          onClick={onRemove}
          className="w-8 h-8 rounded-md flex items-center justify-center text-[#5c5c60] hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
  // FFmpeg.wasm doesn't always emit progress for short operations — fall
  // back to an indeterminate shimmer when we have nothing to draw yet.
  const indeterminate = progress <= 0;
  return (
    <div
      className="relative h-1.5 w-32 sm:w-44 rounded-full overflow-hidden"
      style={{ backgroundColor: "#26262a" }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : pct}
    >
      <div
        className={
          indeterminate
            ? "absolute inset-y-0 left-0 w-1/3 rounded-full converter-progress-shimmer"
            : "absolute inset-y-0 left-0 rounded-full transition-[width] duration-150"
        }
        style={{
          width: indeterminate ? undefined : `${pct}%`,
          backgroundImage:
            "linear-gradient(90deg, #5eead4 0%, #34d399 100%)",
        }}
      />
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[17px] h-[17px]"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[17px] h-[17px]"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function FormatMenu({
  current,
  options,
  onPick,
  align = "left",
}: {
  current: string;
  options: readonly string[];
  onPick: (f: string) => void;
  align?: "left" | "right";
}) {
  return (
    <div
      role="menu"
      className={`absolute top-full mt-2 min-w-[140px] rounded-xl py-1 z-20 max-h-[260px] overflow-y-auto ${
        align === "right" ? "right-0" : "left-0"
      }`}
      style={{
        backgroundColor: "#121214",
        border: "1px solid #1f1f22",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      {options.map((f) => (
        <button
          key={f}
          type="button"
          role="menuitem"
          onClick={() => onPick(f)}
          className="w-full text-left px-3 py-1.5 text-[14px] hover:bg-white/5 transition-colors"
          style={{
            color: f === current ? "#ffffff" : "#8e8e93",
            fontWeight: f === current ? 600 : 400,
          }}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[17px] h-[17px]"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[17px] h-[17px]"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

