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

import { useState, useRef } from "react";

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
    settings: ComposerSettingsState;
    onSettingsChange: (settings: ComposerSettingsState) => void;
    open: boolean;
    onClose: () => void;
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
    settings,
    onSettingsChange,
    open,
    onClose,
}: ComposerSettingsProps) {
    const [view, setView] = useState<"root" | "model">("root");
    const [modelSearch, setModelSearch] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);

    if (!open) {
        // Reset internal state when closed. Safe during render because
        // the component returns null immediately — no cascading renders.
        if (view !== "root") setView("root");
        if (modelSearch !== "") setModelSearch("");
        return null;
    }

    const selectedModel = models.find((m) => m.id === settings.model);
    const filteredModels = models.filter((m) =>
        m.name.toLowerCase().includes(modelSearch.toLowerCase()),
    );

    function update(partial: Partial<ComposerSettingsState>) {
        onSettingsChange({ ...settings, ...partial });
    }

    return (
        <>
            {/* Backdrop — closes the modal */}
            <div
                className="fixed inset-0 z-[60]"
                onClick={onClose}
                aria-hidden
            />

            {/* Modal — anchored above the composer */}
            <div className="absolute bottom-full left-0 right-0 z-[70] mb-2">
                <div className="overflow-hidden rounded-2xl bg-[#1a1a1c]/90 ring-1 ring-white/[0.05] backdrop-blur-2xl">
                    {view === "root" ? (
                        <RootView
                            selectedModel={selectedModel}
                            settings={settings}
                            onUpdate={update}
                            onDrillToModel={() => setView("model")}
                        />
                    ) : (
                        <ModelListView
                            models={filteredModels}
                            activeModelId={settings.model}
                            search={modelSearch}
                            onSearchChange={setModelSearch}
                            searchInputRef={searchInputRef}
                            onSelect={(id) => {
                                update({ model: id });
                                setView("root");
                            }}
                            onBack={() => setView("root")}
                        />
                    )}
                </div>
            </div>
        </>
    );
}

// ─── Root view ──────────────────────────────────────────────────────────────

function RootView({
    selectedModel,
    settings,
    onUpdate,
    onDrillToModel,
}: {
    selectedModel: Model | undefined;
    settings: ComposerSettingsState;
    onUpdate: (partial: Partial<ComposerSettingsState>) => void;
    onDrillToModel: () => void;
}) {
    return (
        <div className="flex flex-col">
            {/* Handle + title */}
            <div className="flex flex-col items-center px-4 pt-2 pb-0.5 sm:px-5">
                <div className="mb-2.5 h-[3px] w-8 rounded-full bg-white/15" />
                <span className="self-start text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
                    Image Settings
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

            {/* Aspect ratio */}
            <div className="flex items-center justify-between px-4 pt-3.5 sm:px-5">
                <span className="text-[13px] text-[#9ca3af]">Aspect ratio</span>
                <AspectRatioPicker
                    value={settings.aspectRatio}
                    onChange={(v) => onUpdate({ aspectRatio: v })}
                />
            </div>

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
        <div className="flex h-[34px] items-center overflow-hidden rounded-[10px] border border-white/5 bg-[#202022]">
            <button
                type="button"
                onClick={() => onChange(Math.max(1, value - 1))}
                disabled={value <= 1}
                className="flex h-full w-[36px] items-center justify-center text-[#9ca3af] transition-colors hover:bg-white/[0.04] hover:text-white disabled:opacity-30"
                aria-label="Decrease"
            >
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                >
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </button>
            <span className="w-[32px] select-none text-center text-[14px] font-medium">
                {value}
            </span>
            <button
                type="button"
                onClick={() => onChange(Math.min(4, value + 1))}
                disabled={value >= 4}
                className="flex h-full w-[36px] items-center justify-center text-[#9ca3af] transition-colors hover:bg-white/[0.04] hover:text-white disabled:opacity-30"
                aria-label="Increase"
            >
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </button>
        </div>
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
            <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
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
                <svg
                    className="text-[#52525b]"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search models..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="flex-1 bg-transparent text-[13px] text-white placeholder-[#52525b] outline-none"
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
