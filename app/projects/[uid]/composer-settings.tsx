"use client";

/**
 * ComposerSettings — generation settings modal.
 *
 * Anchored above the composer bar. Two views:
 *   • Root: model trigger, aspect ratio picker, batch count stepper
 *   • Model detail: searchable list of available models (drill-down)
 *
 * Controlled by the parent (open/close state lives in the composer).
 */

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Model {
    id: string;
    name: string;
    description: string;
    creditBase: number;
}

export interface ComposerSettingsState {
    model: string;
    aspectRatio: string;
    sampleCount: number;
}

interface ComposerSettingsProps {
    models: Model[];
    videoModels: Model[];
    mode: "image" | "video";
    videoModelId: string;
    onVideoModelChange: (id: string) => void;
    settings: ComposerSettingsState;
    onSettingsChange: (settings: ComposerSettingsState) => void;
    open: boolean;
    onClose: () => void;
    /** Ref to the controls row so outside-click detection can exclude it. */
    triggerRef?: React.RefObject<HTMLElement | null>;
}

// ─── Aspect ratio data ──────────────────────────────────────────────────────

const ASPECT_RATIOS = [
    { value: "16:9", icon: <rect width="18" height="10" x="3" y="7" rx="2" ry="2" /> },
    { value: "3:2", icon: <rect width="18" height="12" x="3" y="6" rx="2" ry="2" /> },
    { value: "4:3", icon: <rect width="18" height="13.5" x="3" y="5.25" rx="2" ry="2" /> },
    { value: "1:1", icon: <rect width="16" height="16" x="4" y="4" rx="3" ry="3" /> },
    { value: "3:4", icon: <rect width="13.5" height="18" x="5.25" y="3" rx="2" ry="2" /> },
    { value: "2:3", icon: <rect width="12" height="18" x="6" y="3" rx="2" ry="2" /> },
    { value: "9:16", icon: <rect width="10" height="18" x="7" y="3" rx="2" ry="2" /> },
] as const;

// ─── Component ──────────────────────────────────────────────────────────────

export function ComposerSettings({
    models,
    videoModels,
    mode,
    videoModelId,
    onVideoModelChange,
    settings,
    onSettingsChange,
    open,
    onClose,
    triggerRef,
}: ComposerSettingsProps) {
    const [view, setView] = useState<"root" | "model">("root");
    const [modelSearch, setModelSearch] = useState("");
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    // Measure the trigger's viewport position so the portal-rendered
    // panel can anchor itself above it. Re-measure on resize + scroll so
    // the panel stays pinned while the page moves.
    useLayoutEffect(() => {
        if (!open) {
            // Drop the cached rect so the next open measures fresh
            // before painting — avoids a one-frame flash at a stale
            // position when the trigger has moved.
            // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM measurement state
            setAnchorRect(null);
            return;
        }
        function measure() {
            if (triggerRef?.current) {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM measurement state
                setAnchorRect(triggerRef.current.getBoundingClientRect());
            }
        }
        measure();
        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, true);
        return () => {
            window.removeEventListener("resize", measure);
            window.removeEventListener("scroll", measure, true);
        };
    }, [open, triggerRef]);

    // Close on outside click or Escape.
    useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            const target = e.target as Node;
            // Ignore clicks inside the panel itself.
            if (modalRef.current?.contains(target)) return;
            // Ignore clicks on the trigger button — the button's own
            // onClick handler manages the toggle. Without this, the
            // outside-click fires first (closing), then onClick toggles
            // it back open, making the button appear broken.
            if (triggerRef?.current?.contains(target)) return;
            onClose();
        }
        function handleEsc(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        // Use setTimeout so the opening click doesn't immediately close.
        const timer = setTimeout(() => {
            document.addEventListener("mousedown", handleClick);
            document.addEventListener("keydown", handleEsc);
        }, 0);
        return () => {
            clearTimeout(timer);
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleEsc);
        };
    }, [open, onClose, triggerRef]);

    if (!open || !anchorRect) {
        if (view !== "root") setView("root");
        if (modelSearch !== "") setModelSearch("");
        return null;
    }

    const isVideo = mode === "video";
    const activeModels = isVideo ? videoModels : models;
    const activeModelId = isVideo ? videoModelId : settings.model;
    const selectedModel = activeModels.find((m) => m.id === activeModelId);
    const filteredModels = activeModels.filter((m) =>
        m.name.toLowerCase().includes(modelSearch.toLowerCase()),
    );

    function update(partial: Partial<ComposerSettingsState>) {
        onSettingsChange({ ...settings, ...partial });
    }

    function handleModelSelect(id: string) {
        if (isVideo) {
            onVideoModelChange(id);
        } else {
            update({ model: id });
        }
        setView("root");
    }

    // Render via portal to <body> so the panel escapes the composer's
    // `backdrop-blur` ancestor — nested backdrop filters get clipped by
    // their ancestor's stacking context, which is what made the panel
    // look transparent-without-blur. `fixed` + measured trigger rect
    // keeps the old visual placement (anchored above the gear button).
    const panel = (
        <div
            ref={modalRef}
            style={{
                position: "fixed",
                bottom: window.innerHeight - anchorRect.top + 8,
                left: anchorRect.left,
                width: anchorRect.width,
                zIndex: 70,
            }}
        >
            <div className="overflow-hidden rounded-2xl bg-[#1a1a1c]/90 ring-1 ring-white/[0.05] backdrop-blur-2xl">
                {view === "root" ? (
                    <RootView
                        selectedModel={selectedModel}
                        settings={settings}
                        isVideo={isVideo}
                        onUpdate={update}
                        onDrillToModel={() => setView("model")}
                    />
                ) : (
                    <ModelListView
                        models={filteredModels}
                        activeModelId={activeModelId}
                        search={modelSearch}
                        onSearchChange={setModelSearch}
                        searchInputRef={searchInputRef}
                        onSelect={handleModelSelect}
                        onBack={() => setView("root")}
                    />
                )}
            </div>
        </div>
    );

    return createPortal(panel, document.body);
}

// ─── Root view ──────────────────────────────────────────────────────────────

function RootView({
    selectedModel,
    settings,
    isVideo,
    onUpdate,
    onDrillToModel,
}: {
    selectedModel: Model | undefined;
    settings: ComposerSettingsState;
    isVideo: boolean;
    onUpdate: (partial: Partial<ComposerSettingsState>) => void;
    onDrillToModel: () => void;
}) {
    const [aspectExpanded, setAspectExpanded] = useState(false);

    const currentAspect = ASPECT_RATIOS.find(
        (ar) => ar.value === settings.aspectRatio,
    );

    return (
        <div className="flex flex-col">
            {/* Handle + title */}
            <div className="flex flex-col items-center px-4 pt-2 pb-0.5 sm:px-5">
                <div className="mb-2.5 h-[3px] w-8 rounded-full bg-white/15" />
                <span className="self-start text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
                    {isVideo ? "Video Settings" : "Image Settings"}
                </span>
            </div>

            {/* Model */}
            <div className="flex flex-col gap-1 px-4 pt-2.5 sm:px-5">
                <span className="text-[13px] text-[#9ca3af]">Model</span>
                <button
                    type="button"
                    onClick={onDrillToModel}
                    className="flex w-full items-center justify-between rounded-[10px] border border-white/5 bg-[#202022] px-3 py-2 text-left transition-colors hover:bg-[#282829]"
                >
                    <span className="text-[14px] font-medium">
                        {selectedModel?.name ?? "Select model"}
                    </span>
                    <svg
                        className="shrink-0 text-[#52525b]"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>
            </div>

            {/* Aspect ratio — compact pill, expands to full picker on tap */}
            <div className="flex items-center justify-between px-4 pt-3.5 sm:px-5">
                <span className="text-[13px] text-[#9ca3af]">Aspect ratio</span>
                <button
                    type="button"
                    onClick={() => setAspectExpanded((o) => !o)}
                    className="flex h-[34px] w-[72px] items-center justify-center gap-1.5 rounded-[10px] border border-white/5 bg-[#202022] transition-colors hover:bg-[#282829]"
                >
                    <svg
                        className="shrink-0 text-gray-300"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        {currentAspect?.icon}
                    </svg>
                    <span className="text-[13px] font-medium">
                        {settings.aspectRatio}
                    </span>
                </button>
            </div>

            {/* Expanded aspect ratio picker */}
            {aspectExpanded && (
                <div className="px-4 pt-2 pb-1 sm:px-5">
                    <AspectRatioPicker
                        value={settings.aspectRatio}
                        onChange={(v) => {
                            onUpdate({ aspectRatio: v });
                            setAspectExpanded(false);
                        }}
                    />
                </div>
            )}

            {/* Batch count */}
            <div className="flex items-center justify-between px-4 pb-4 pt-3.5 sm:px-5">
                <span className="text-[13px] text-[#9ca3af]">Generations</span>
                <BatchStepper
                    value={settings.sampleCount}
                    onChange={(v) => onUpdate({ sampleCount: v })}
                />
            </div>
        </div>
    );
}

// ─── Aspect ratio picker ────────────────────────────────────────────────────

function AspectRatioPicker({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="flex items-center gap-0.5 rounded-xl border border-white/5 bg-[#202022] p-1">
            {ASPECT_RATIOS.map((ar) => {
                const active = ar.value === value;
                return (
                    <button
                        key={ar.value}
                        type="button"
                        onClick={() => onChange(ar.value)}
                        className={`flex flex-col items-center justify-center rounded-lg px-1.5 py-1.5 transition-colors ${
                            active
                                ? "bg-[#313135] shadow-sm"
                                : "hover:bg-white/[0.05]"
                        }`}
                        aria-label={ar.value}
                    >
                        <svg
                            className={`${active ? "text-white" : "text-[#9ca3af]"} transition-colors`}
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            {ar.icon}
                        </svg>
                        <span
                            className={`mt-0.5 text-[10px] font-medium ${
                                active ? "text-white" : "text-[#9ca3af]"
                            } transition-colors`}
                        >
                            {ar.value}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

// ─── Batch stepper ──────────────────────────────────────────────────────────

function BatchStepper({
    value,
    onChange,
}: {
    value: number;
    onChange: (v: number) => void;
}) {
    return (
        <div className="flex h-[34px] w-[72px] items-center rounded-[10px] border border-white/5 bg-[#202022] px-0.5">
            <StepperButton
                label="Decrease"
                disabled={value <= 1}
                onClick={() => onChange(Math.max(1, value - 1))}
            >
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                >
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </StepperButton>
            <span className="w-5 select-none text-center text-[13px] font-semibold tabular-nums tracking-tight text-white">
                {value}
            </span>
            <StepperButton
                label="Increase"
                disabled={value >= 4}
                onClick={() => onChange(Math.min(4, value + 1))}
            >
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </StepperButton>
        </div>
    );
}

function StepperButton({
    label,
    disabled,
    onClick,
    children,
}: {
    label: string;
    disabled: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    // Button fills the full control height so the hit-target stays
    // generous, but the hover background is painted on an inner
    // square so the highlight reads as a rounded square rather than a
    // vertical rectangle.
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className="group/step flex h-full w-6 items-center justify-center text-[#9ca3af] transition-colors duration-150 hover:text-white disabled:cursor-not-allowed disabled:text-[#3f3f46]"
        >
            <span className="flex h-5 w-5 items-center justify-center rounded-md transition-colors duration-150 group-hover/step:bg-white/10 group-active/step:bg-white/[0.14]">
                {children}
            </span>
        </button>
    );
}

// ─── Model list view (drill-down) ───────────────────────────────────────────

function ModelListView({
    models,
    activeModelId,
    search,
    onSearchChange,
    searchInputRef,
    onSelect,
    onBack,
}: {
    models: Model[];
    activeModelId: string;
    search: string;
    onSearchChange: (v: string) => void;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    onSelect: (id: string) => void;
    onBack: () => void;
}) {
    return (
        <div className="flex flex-col">
            {/* Search bar */}
            <div className="flex items-center gap-2 pl-3 pr-12 pb-1.5 pt-2.5">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.06]"
                    aria-label="Back"
                >
                    <svg
                        className="text-[#9ca3af]"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search models..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="flex-1 rounded-lg border border-white/[0.06] bg-transparent px-2.5 py-1.5 text-[13px] text-white placeholder-[#52525b] outline-none focus:border-white/[0.12]"
                    autoComplete="off"
                    autoFocus
                />
            </div>

            {/* Model list */}
            <div className="flex max-h-[280px] flex-col gap-0.5 overflow-y-auto p-1.5 pt-0">
                {models.length === 0 ? (
                    <p className="py-6 text-center text-[13px] text-[#52525b]">
                        No models found
                    </p>
                ) : (
                    models.map((m) => {
                        const active = m.id === activeModelId;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => onSelect(m.id)}
                                className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-all ${
                                    active
                                        ? "bg-[#2a2a2d]"
                                        : "hover:bg-white/[0.05]"
                                }`}
                            >
                                <div className="flex min-w-0 flex-col items-start">
                                    <span
                                        className={`text-[14px] font-medium ${
                                            active
                                                ? "text-white"
                                                : "text-[#9ca3af] group-hover:text-white"
                                        } transition-colors`}
                                    >
                                        {m.name}
                                    </span>
                                    <span
                                        className={`mt-[1px] text-[12px] ${
                                            active
                                                ? "text-[#9ca3af]"
                                                : "text-[#52525b] group-hover:text-[#9ca3af]"
                                        } transition-colors`}
                                    >
                                        {m.description}
                                    </span>
                                </div>
                                {active && (
                                    <svg
                                        className="ml-3 shrink-0 text-white"
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                )}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// Re-export for the composer's type needs.
export type { Model };
