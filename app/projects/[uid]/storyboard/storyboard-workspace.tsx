"use client";

/**
 * StoryboardWorkspace — client root for the storyboard surface.
 *
 *   • Provides the Zustand store via context.
 *   • Owns the single top-level DndContext that drives both scene and
 *     shot drag-reordering (same context so cross-scene shot moves
 *     work transparently).
 *   • Renders the toolbar, the scene list, and the empty state.
 *
 * Drag rules (see `onDragEnd`):
 *
 *   • Scene-over-scene → reorder scenes within the storyboard.
 *   • Shot-over-shot → if same scene, reorder inside; if different
 *     scene, move into the target scene at the dropped position.
 *   • Shot-over-scene-drop (empty scene) → append to that scene.
 *
 * Performance notes (Slice 1 — no virtualization yet, Slice 5 owns
 * that): a 50-scene / 200-shot board renders in <100ms on a Mac. We
 * read narrow slices via Zustand selectors so a textarea keystroke in
 * one shot doesn't re-render the whole tree.
 */

import { useState } from "react";
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import type { Scene, Shot, StoryboardBoard } from "@/lib/storyboards";

import { SceneCard } from "./scene-card";
import { ShotCard } from "./shot-card";
import { StoryboardProvider, useStoryboard } from "./workspace-context";

// ─── Outer wrapper ─────────────────────────────────────────────────────────

export function StoryboardWorkspace({ initial }: { initial: StoryboardBoard }) {
    return (
        <StoryboardProvider initial={initial}>
            <Workspace />
        </StoryboardProvider>
    );
}

// ─── Inner — has access to the store ───────────────────────────────────────

function Workspace() {
    const scenes = useStoryboard((s) => s.scenes);
    const title = useStoryboard((s) => s.title);
    const addScene = useStoryboard((s) => s.addScene);
    const renameStoryboard = useStoryboard((s) => s.renameStoryboard);
    const reorderScenes = useStoryboard((s) => s.reorderScenes);
    const reorderShots = useStoryboard((s) => s.reorderShots);

    // Track what's currently being dragged so the overlay can render a
    // ghost of the active item. Without an overlay, dnd-kit drags the
    // original node — which jumps when the layout reflows around it.
    const [activeDrag, setActiveDrag] = useState<
        | { kind: "scene"; scene: Scene }
        | { kind: "shot"; shot: Shot }
        | null
    >(null);

    const sensors = useSensors(
        // 6px activation distance — small enough to feel responsive,
        // large enough that a click on a card's textarea/input still
        // registers as a click and not a drag.
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const totalRuntimeMs = scenes.reduce(
        (sum, sc) => sum + sc.shots.reduce((s, sh) => s + sh.durationMs, 0),
        0,
    );
    const totalShots = scenes.reduce((sum, sc) => sum + sc.shots.length, 0);

    function onDragStart(e: DragStartEvent) {
        const data = e.active.data.current;
        if (!data) return;
        if (data.type === "scene") {
            const scene = scenes.find((s) => s.uid === e.active.id);
            if (scene) setActiveDrag({ kind: "scene", scene });
        } else if (data.type === "shot") {
            for (const sc of scenes) {
                const shot = sc.shots.find((sh) => sh.uid === e.active.id);
                if (shot) {
                    setActiveDrag({ kind: "shot", shot });
                    return;
                }
            }
        }
    }

    function onDragEnd(e: DragEndEvent) {
        setActiveDrag(null);

        const { active, over } = e;
        if (!over) return;

        const activeData = active.data.current;
        const overData = over.data.current;
        if (!activeData || !overData) return;

        // ─── Scene ↔ scene reorder ─────────────────────────────────
        if (activeData.type === "scene" && overData.type === "scene") {
            if (active.id === over.id) return;
            const oldIndex = scenes.findIndex((s) => s.uid === active.id);
            const newIndex = scenes.findIndex((s) => s.uid === over.id);
            if (oldIndex < 0 || newIndex < 0) return;
            const next = arrayMove(scenes.map((s) => s.uid), oldIndex, newIndex);
            reorderScenes(next);
            return;
        }

        // ─── Shot moves ────────────────────────────────────────────
        if (activeData.type !== "shot") return;
        const fromSceneUid = activeData.sceneUid as string;

        // Resolve destination scene + insert index from the over target.
        let toSceneUid: string;
        let insertIndex: number;

        if (overData.type === "shot") {
            toSceneUid = overData.sceneUid as string;
            const dest = scenes.find((s) => s.uid === toSceneUid);
            if (!dest) return;
            const idx = dest.shots.findIndex((sh) => sh.uid === over.id);
            if (idx < 0) return;
            insertIndex = idx;
        } else if (overData.type === "scene-drop") {
            // Empty scene drop zone — append.
            toSceneUid = overData.sceneUid as string;
            const dest = scenes.find((s) => s.uid === toSceneUid);
            if (!dest) return;
            insertIndex = dest.shots.length;
        } else {
            return;
        }

        const dest = scenes.find((s) => s.uid === toSceneUid);
        if (!dest) return;

        if (fromSceneUid === toSceneUid) {
            // Same-scene reorder
            const oldIndex = dest.shots.findIndex((sh) => sh.uid === active.id);
            if (oldIndex < 0 || oldIndex === insertIndex) return;
            const next = arrayMove(
                dest.shots.map((sh) => sh.uid),
                oldIndex,
                insertIndex,
            );
            reorderShots(toSceneUid, next);
            return;
        }

        // Cross-scene move — build the new shot list for the
        // destination, then send it. The store handles compacting the
        // source scene.
        const nextUids = dest.shots.map((sh) => sh.uid);
        nextUids.splice(insertIndex, 0, String(active.id));
        reorderShots(toSceneUid, nextUids);
    }

    return (
        <main className="mx-auto max-w-[85rem] px-4 pb-12 pt-6 sm:px-6 sm:pt-8">
            <Header
                title={title}
                totalShots={totalShots}
                totalRuntimeMs={totalRuntimeMs}
                onRename={renameStoryboard}
                onAddScene={() => addScene()}
            />

            {scenes.length === 0 ? (
                <EmptyState onAddScene={() => addScene()} />
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onDragCancel={() => setActiveDrag(null)}
                >
                    <SortableContext
                        items={scenes.map((s) => s.uid)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="mt-6 flex flex-col gap-5">
                            {scenes.map((scene, i) => (
                                <SceneCard
                                    key={scene.uid}
                                    scene={scene}
                                    index={i + 1}
                                />
                            ))}
                        </div>
                    </SortableContext>

                    {/* Render the dragged item in an overlay so it
                        floats with the pointer/keyboard without being
                        constrained by the source list's layout. */}
                    <DragOverlay dropAnimation={null}>
                        {activeDrag?.kind === "shot" && (
                            <ShotCard shot={activeDrag.shot} index={0} />
                        )}
                        {activeDrag?.kind === "scene" && (
                            <div className="rounded-2xl border border-white/15 bg-ws-surface px-5 py-4 shadow-xl">
                                <div className="text-[15px] font-semibold uppercase tracking-wide text-white">
                                    {activeDrag.scene.slugline ?? "(Untitled scene)"}
                                </div>
                                <div className="text-[12px] text-ws-icon">
                                    {activeDrag.scene.shots.length} shot
                                    {activeDrag.scene.shots.length === 1 ? "" : "s"}
                                </div>
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>
            )}
        </main>
    );
}

// ─── Header ────────────────────────────────────────────────────────────────

function Header({
    title,
    totalShots,
    totalRuntimeMs,
    onRename,
    onAddScene,
}: {
    title: string;
    totalShots: number;
    totalRuntimeMs: number;
    onRename: (v: string) => void;
    onAddScene: () => void;
}) {
    return (
        <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
                <input
                    type="text"
                    defaultValue={title}
                    aria-label="Storyboard title"
                    onBlur={(e) => {
                        const v = e.currentTarget.value.trim();
                        if (v && v !== title) onRename(v);
                        else e.currentTarget.value = title;
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            (e.currentTarget as HTMLInputElement).blur();
                        }
                    }}
                    className="w-full max-w-md bg-transparent text-[22px] font-semibold tracking-tight text-white outline-none sm:text-[28px]"
                />
                <div className="mt-0.5 flex items-center gap-3 text-[12px] text-ws-icon">
                    <span>
                        {totalShots} shot{totalShots === 1 ? "" : "s"}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">
                        {formatRuntime(totalRuntimeMs)}
                    </span>
                </div>
            </div>

            <button
                type="button"
                onClick={onAddScene}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-[13px] font-semibold text-black transition-colors hover:bg-white/90"
            >
                <Plus className="h-4 w-4" />
                Add scene
            </button>
        </header>
    );
}

function formatRuntime(ms: number): string {
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// ─── Empty state ───────────────────────────────────────────────────────────

function EmptyState({ onAddScene }: { onAddScene: () => void }) {
    return (
        <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 px-6 py-16 text-center">
            <h2 className="text-[18px] font-semibold text-white">
                Start your storyboard
            </h2>
            <p className="mt-1 max-w-md text-[13px] text-ws-icon">
                A storyboard is a sequence of scenes, each with a handful
                of shots. Sketch the film one card at a time, then drag
                to reorder.
            </p>
            <button
                type="button"
                onClick={onAddScene}
                className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-1.5 text-[13px] font-semibold text-black transition-colors hover:bg-white/90"
            >
                <Plus className="h-4 w-4" />
                Add your first scene
            </button>
        </div>
    );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
    const result = arr.slice();
    const [item] = result.splice(from, 1);
    result.splice(to, 0, item);
    return result;
}
