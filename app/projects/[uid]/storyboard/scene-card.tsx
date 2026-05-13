"use client";

/**
 * SceneCard — a scene container holding an ordered list of shot cards.
 *
 * Layout:
 *
 *   ┌─ scene header ──────────────────────────────────────────────┐
 *   │  #1  INT. WAREHOUSE — NIGHT          [···]                  │
 *   │      action line (one-liner)                                │
 *   └──────────────────────────────────────────────────────────────┘
 *      ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
 *      │ shot │ │ shot │ │ shot │ │  +   │
 *      └──────┘ └──────┘ └──────┘ └──────┘
 *
 * Shots inside the scene live in their own `SortableContext` so they
 * can be reordered within the scene. The same `DndContext` at the
 * workspace level handles cross-scene drags (the destination scene's
 * shots `SortableContext` registers a drop zone via `useSortable` on
 * the scene's drop area, picked up by the workspace `onDragOver`).
 */

import { useState } from "react";
import { SortableContext, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreVertical, Plus, Trash2 } from "lucide-react";

import type { Scene } from "@/lib/storyboards";

import { ShotCard } from "./shot-card";
import { useStoryboard } from "./workspace-context";

interface Props {
    scene: Scene;
    /** 1-indexed scene number, for the header badge. */
    index: number;
}

export function SceneCard({ scene, index }: Props) {
    const updateScene = useStoryboard((s) => s.updateScene);
    const deleteScene = useStoryboard((s) => s.deleteScene);
    const addShot = useStoryboard((s) => s.addShot);

    // Sortable wrapper for the scene itself — dragged by the grip
    // handle in the header. The card body is NOT a drag handle (would
    // conflict with shot-level dragging inside).
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: scene.uid,
        data: { type: "scene" },
    });

    // Empty-scene drop target — when the scene has no shots, the
    // shot SortableContext can't accept drops on its own (no children
    // to anchor). We register an explicit droppable so cross-scene
    // moves into an empty scene work.
    const { setNodeRef: setDropRef, isOver } = useDroppable({
        id: `scene-drop-${scene.uid}`,
        data: { type: "scene-drop", sceneUid: scene.uid },
    });

    const sceneStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    } as const;

    return (
        <section
            ref={setNodeRef}
            style={sceneStyle}
            className="rounded-2xl border border-white/[0.06] bg-black/20 p-4 sm:p-5"
            aria-label={`Scene ${index}`}
        >
            <SceneHeader
                index={index}
                slugline={scene.slugline}
                action={scene.action}
                dragHandleProps={{ ...attributes, ...listeners }}
                onCommitSlugline={(v) =>
                    updateScene(scene.uid, { slugline: v.length ? v : null })
                }
                onCommitAction={(v) =>
                    updateScene(scene.uid, { action: v.length ? v : null })
                }
                onDelete={() => deleteScene(scene.uid)}
            />

            <SortableContext
                items={scene.shots.map((sh) => sh.uid)}
                strategy={rectSortingStrategy}
            >
                <div
                    ref={setDropRef}
                    className={`mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${
                        isOver && scene.shots.length === 0
                            ? "rounded-xl bg-white/[0.02] ring-1 ring-inset ring-white/15"
                            : ""
                    }`}
                >
                    {scene.shots.map((shot, i) => (
                        <ShotCard key={shot.uid} shot={shot} index={i + 1} />
                    ))}

                    <AddShotTile onClick={() => addShot(scene.uid)} />
                </div>
            </SortableContext>
        </section>
    );
}

// ─── Pieces ────────────────────────────────────────────────────────────────

function SceneHeader({
    index,
    slugline,
    action,
    dragHandleProps,
    onCommitSlugline,
    onCommitAction,
    onDelete,
}: {
    index: number;
    slugline: string | null;
    action: string | null;
    dragHandleProps: Record<string, unknown>;
    onCommitSlugline: (v: string) => void;
    onCommitAction: (v: string) => void;
    onDelete: () => void;
}) {
    return (
        <header className="flex items-start gap-3">
            <button
                type="button"
                aria-label="Drag to reorder scene"
                className="mt-1 cursor-grab text-ws-dim transition-colors hover:text-ws-icon active:cursor-grabbing"
                {...dragHandleProps}
            >
                <GripVertical className="h-4 w-4" />
            </button>

            <span
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-[12px] font-semibold tabular-nums text-ws-icon"
                aria-hidden="true"
            >
                {index}
            </span>

            <div className="min-w-0 flex-1 space-y-0.5">
                <InlineText
                    value={slugline ?? ""}
                    placeholder="INT. LOCATION — TIME"
                    className="text-[15px] font-semibold uppercase tracking-wide text-white placeholder:font-normal placeholder:text-ws-dim placeholder:normal-case"
                    onCommit={onCommitSlugline}
                />
                <InlineText
                    value={action ?? ""}
                    placeholder="Describe the action…"
                    className="text-[13px] text-ws-icon placeholder:text-ws-dim"
                    onCommit={onCommitAction}
                />
            </div>

            <SceneMenu onDelete={onDelete} />
        </header>
    );
}

function InlineText({
    value,
    placeholder,
    className,
    onCommit,
}: {
    value: string;
    placeholder: string;
    className: string;
    onCommit: (v: string) => void;
}) {
    return (
        <input
            type="text"
            defaultValue={value}
            placeholder={placeholder}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                    (e.currentTarget as HTMLInputElement).blur();
                }
            }}
            onBlur={(e) => onCommit(e.currentTarget.value.trim())}
            className={`w-full bg-transparent outline-none ${className}`}
        />
    );
}

function SceneMenu({ onDelete }: { onDelete: () => void }) {
    const [open, setOpen] = useState(false);

    return (
        <div
            className="relative"
            onPointerDown={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-label="Scene menu"
                className="rounded-md p-1 text-ws-dim transition-colors hover:bg-white/[0.04] hover:text-ws-icon"
            >
                <MoreVertical className="h-4 w-4" />
            </button>
            {open && (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-30 cursor-default"
                        aria-hidden
                        onClick={() => setOpen(false)}
                    />
                    <div
                        role="menu"
                        className="ui-menu absolute right-0 top-full z-40 mt-1"
                        style={{ minWidth: 180 }}
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
                            <span>Delete scene</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

function AddShotTile({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label="Add shot"
            className="group/add flex aspect-video items-center justify-center rounded-xl border border-dashed border-white/15 bg-transparent text-ws-dim transition-colors hover:border-white/30 hover:bg-white/[0.02] hover:text-white"
        >
            <span className="flex items-center gap-1.5 text-[12px] font-medium">
                <Plus className="h-4 w-4" />
                Add shot
            </span>
        </button>
    );
}
