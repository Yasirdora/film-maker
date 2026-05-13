"use client";

/**
 * ShotCard — a single shot inside a scene.
 *
 * Renders a 16:9 visual slot (placeholder until Slice 2 wires AI image
 * generation), a prompt textarea that auto-grows, the planned duration,
 * and a chip row for shot metadata. Hover/focus reveals a kebab menu
 * (delete, planned: duplicate, regenerate).
 *
 * Editing model: changes commit on `blur` / Enter (for the duration
 * input). Optimistic update + server PATCH happens in the store; the
 * input is uncontrolled past the initial value to keep typing latency
 * at zero — controlled inputs that round-trip through Zustand selector
 * + memo can drop frames at scale.
 *
 * Drag handle: the entire card surface is the handle, except the
 * textarea, duration input, and menu (those swallow pointer-down so
 * the user can interact without starting a drag).
 */

import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreVertical, Trash2 } from "lucide-react";

import type { Shot } from "@/lib/storyboards";

import { useStoryboard } from "./workspace-context";

interface Props {
    shot: Shot;
    /** 1-indexed shot number inside its scene, for the chip badge. */
    index: number;
}

export function ShotCard({ shot, index }: Props) {
    const updateShot = useStoryboard((s) => s.updateShot);
    const deleteShot = useStoryboard((s) => s.deleteShot);

    // dnd-kit hooks. `data` is what the workspace's onDragEnd reads to
    // know that the active item is a shot (vs a scene) and which scene
    // it currently lives in.
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: shot.uid,
        data: { type: "shot", sceneUid: shot.sceneUid },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        // While dragging, fade the source — the overlay carries the
        // visible card so users always see what they're holding.
        opacity: isDragging ? 0.4 : 1,
    } as const;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="group relative flex flex-col gap-2 rounded-xl border border-white/10 bg-ws-surface p-3 transition-colors hover:border-white/20"
            {...attributes}
            {...listeners}
        >
            {/* 16:9 visual placeholder. Will hold the generated frame in
                Slice 2; until then, a quiet film-strip motif so the
                empty card doesn't read as broken. */}
            <div className="relative overflow-hidden rounded-md bg-black/40 aspect-video">
                <div className="absolute inset-0 flex items-center justify-center text-ws-dim">
                    <FilmStripGlyph />
                </div>
                <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums backdrop-blur-sm">
                    {index}
                </span>
                <DurationInput
                    value={shot.durationMs}
                    onCommit={(durationMs) => updateShot(shot.uid, { durationMs })}
                />
            </div>

            <PromptField
                initialValue={shot.prompt ?? ""}
                onCommit={(prompt) =>
                    updateShot(shot.uid, { prompt: prompt.length ? prompt : null })
                }
            />

            {/* Metadata chip row — empty for now (Slice 1). The slots
                will be inline shotType / cameraMove pickers in a
                follow-up. Reserving the row keeps card height stable. */}
            <div className="flex h-6 items-center gap-1.5 text-[11px] text-ws-icon">
                {shot.shotType && (
                    <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5">
                        {shot.shotType.replace(/_/g, " ").toLowerCase()}
                    </span>
                )}
                {shot.cameraMove && (
                    <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5">
                        {shot.cameraMove.replace(/_/g, " ").toLowerCase()}
                    </span>
                )}
            </div>

            <ShotMenu onDelete={() => deleteShot(shot.uid)} />
        </div>
    );
}

// ─── Pieces ────────────────────────────────────────────────────────────────

/**
 * Uncontrolled textarea that auto-grows with content. We treat it as
 * uncontrolled past the initial value so typing isn't gated by Zustand
 * re-renders; the value commits to the store on `blur`.
 *
 * The "filled vs empty" text colour is driven by `:placeholder-shown`
 * so we don't need React state to track content presence — the input
 * itself is the authoritative source.
 */
function PromptField({
    initialValue,
    onCommit,
}: {
    initialValue: string;
    onCommit: (value: string) => void;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);

    // Sync the input if upstream (e.g. another tab via a future
    // realtime channel) updates the prompt. Reading + writing the
    // DOM directly here is intentional: this is the bridge between the
    // store's authoritative value and the uncontrolled input.
    useEffect(() => {
        if (ref.current && ref.current.value !== initialValue) {
            ref.current.value = initialValue;
            autosize(ref.current);
        }
    }, [initialValue]);

    return (
        <textarea
            ref={ref}
            defaultValue={initialValue}
            placeholder="Describe this shot…"
            rows={2}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onInput={(e) => autosize(e.currentTarget)}
            onBlur={(e) => onCommit(e.currentTarget.value.trim())}
            className="w-full resize-none bg-transparent text-[13px] leading-snug text-white outline-none placeholder:text-ws-dim placeholder-shown:text-ws-icon"
        />
    );
}

function autosize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
}

function DurationInput({
    value,
    onCommit,
}: {
    value: number;
    onCommit: (durationMs: number) => void;
}) {
    return (
        <label
            className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm"
            onPointerDown={(e) => e.stopPropagation()}
        >
            <input
                type="number"
                step={0.1}
                min={0}
                max={600}
                defaultValue={(value / 1000).toFixed(1)}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                        (e.currentTarget as HTMLInputElement).blur();
                    }
                }}
                onBlur={(e) => {
                    const sec = Number.parseFloat(e.currentTarget.value);
                    if (Number.isFinite(sec) && sec >= 0) {
                        onCommit(Math.round(sec * 1000));
                    } else {
                        // Restore on bad input.
                        e.currentTarget.value = (value / 1000).toFixed(1);
                    }
                }}
                className="w-9 bg-transparent text-right tabular-nums outline-none"
                aria-label="Shot duration in seconds"
            />
            <span className="text-white/70">s</span>
        </label>
    );
}

function ShotMenu({ onDelete }: { onDelete: () => void }) {
    const [open, setOpen] = useState(false);

    return (
        <div
            className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
            onPointerDown={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-label="Shot menu"
                className="rounded-md bg-black/50 p-1 text-white/80 backdrop-blur-sm hover:bg-black/70 hover:text-white"
            >
                <MoreVertical className="h-4 w-4" />
            </button>
            {open && (
                <>
                    {/* Click-outside catcher */}
                    <button
                        type="button"
                        className="fixed inset-0 z-30 cursor-default"
                        aria-hidden
                        onClick={() => setOpen(false)}
                    />
                    <div
                        role="menu"
                        className="ui-menu absolute right-0 top-full z-40 mt-1"
                        style={{ minWidth: 160 }}
                    >
                        <button
                            type="button"
                            role="menuitem"
                            className="ui-menu-item ui-menu-item-danger"
                            onClick={() => {
                                setOpen(false);
                                onDelete();
                            }}
                        >
                            <Trash2 className="h-4 w-4" />
                            <span>Delete shot</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

function FilmStripGlyph() {
    return (
        <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="opacity-50"
        >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 9h18M3 15h18M8 4v16M16 4v16" />
        </svg>
    );
}
