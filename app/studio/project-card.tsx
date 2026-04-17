"use client";

/**
 * ProjectCard — a project tile in the studio grid.
 *
 * Wraps a link to the project workspace with a ⋯ action menu
 * (Pin / Rename / Archive) and a pin indicator. Each card owns its
 * menu + dialog state so multiple cards don't interfere with each other.
 *
 * The `<Link>`-based navigation coexists with interactive buttons by
 * stopping propagation on the ⋯ click — otherwise the link would
 * navigate when the user only wants to open the menu.
 *
 * Client-side because the menu + rename dialog need state; project
 * data itself is static, passed from the server-rendered studio page.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DotsIcon, PinIcon } from "@/components/icons/action-icons";
import { InlineRenameForm } from "@/components/inline-rename-form";
import { ProjectActionMenu } from "@/components/project-action-menu";
import { MAX_PROJECT_NAME_LENGTH } from "@/lib/projects";
import { formatContentCount, formatTimeAgo, isVideoUrl } from "@/lib/utils";

export interface ProjectCardData {
    uid: string;
    name: string;
    coverImageUrl: string | null;
    imageCount: number;
    videoCount: number;
    pinnedAt: number | null;
    updatedAt: number;
}

export function ProjectCard({ project }: { project: ProjectCardData }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [actionError, setActionError] = useState("");
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const router = useRouter();

    const isPinned = project.pinnedAt !== null;
    const refresh = useCallback(() => router.refresh(), [router]);

    /**
     * Persists a new name. Returned error string bubbles back into the
     * inline form so it can display inline validation failures without
     * the parent needing to manage that state.
     */
    async function handleRename(newName: string): Promise<string | null> {
        const trimmed = newName.trim();
        if (!trimmed) return "Name is required";
        if (trimmed === project.name) {
            setIsRenaming(false);
            return null;
        }
        try {
            const res = await fetch(`/api/projects/${project.uid}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed }),
            });
            if (!res.ok) {
                const data = (await res.json().catch(() => ({}))) as {
                    error?: string;
                };
                return data.error ?? "Failed to rename";
            }
            setIsRenaming(false);
            refresh();
            return null;
        } catch {
            return "Something went wrong. Please try again.";
        }
    }

    async function handleTogglePin() {
        setMenuOpen(false);
        setActionError("");
        const endpoint = isPinned ? "unpin" : "pin";
        try {
            const res = await fetch(`/api/projects/${project.uid}/${endpoint}`, {
                method: "POST",
            });
            if (!res.ok) {
                setActionError(isPinned ? "Failed to unpin." : "Failed to pin.");
                return;
            }
            refresh();
        } catch {
            setActionError("Something went wrong. Please try again.");
        }
    }

    function requestArchive() {
        setMenuOpen(false);
        setActionError("");
        setArchiveDialogOpen(true);
    }

    async function confirmArchive() {
        if (isArchiving) return;
        setIsArchiving(true);
        try {
            const res = await fetch(`/api/projects/${project.uid}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                setActionError("Failed to archive.");
                setArchiveDialogOpen(false);
                return;
            }
            setArchiveDialogOpen(false);
            refresh();
        } catch {
            setActionError("Something went wrong. Please try again.");
            setArchiveDialogOpen(false);
        } finally {
            setIsArchiving(false);
        }
    }

    return (
        <>
            <Link
                href={`/projects/${project.uid}`}
                className="group relative overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.06] transition-all hover:ring-white/[0.12]"
            >
                <div className="relative aspect-[2/1] overflow-hidden rounded-b-xl bg-white/[0.02]">
                    {project.coverImageUrl && (
                        isVideoUrl(project.coverImageUrl) ? (
                            <video
                                src={`${project.coverImageUrl}#t=0.1`}
                                muted
                                playsInline
                                preload="metadata"
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                            />
                        ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={project.coverImageUrl}
                                alt={project.name}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                loading="lazy"
                            />
                        )
                    )}

                    {isPinned && (
                        <span
                            aria-hidden
                            className="pointer-events-none absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm"
                        >
                            <PinIcon size={14} />
                        </span>
                    )}
                </div>

                <div className="p-3">
                    {/* Title row — fixed height so swapping between the
                        static title and the inline rename form doesn't
                        shift the content below. The ⋯ trigger lives
                        here (opposite the title) so it stays visible
                        on every surface without hiding the cover. */}
                    <div className="flex h-8 min-w-0 items-center gap-2">
                        {isRenaming ? (
                            <InlineRenameForm
                                initialName={project.name}
                                onSave={handleRename}
                                onCancel={() => setIsRenaming(false)}
                                maxLength={MAX_PROJECT_NAME_LENGTH}
                                size="sm"
                            />
                        ) : (
                            <>
                                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
                                    {project.name}
                                </h3>
                                <button
                                    ref={menuButtonRef}
                                    type="button"
                                    onClick={(e) => {
                                        // Button sits inside a <Link>;
                                        // prevent the navigation that
                                        // would otherwise fire.
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setMenuOpen((prev) => !prev);
                                    }}
                                    aria-label="Project actions"
                                    aria-haspopup="menu"
                                    aria-expanded={menuOpen}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#9ca3af] transition-colors hover:bg-white/[0.06] hover:text-white"
                                >
                                    <DotsIcon size={18} />
                                </button>
                            </>
                        )}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-xs text-[#52525b]">
                        <span>
                            {formatContentCount(project.imageCount, project.videoCount)}
                        </span>
                        <span>{formatTimeAgo(project.updatedAt)}</span>
                    </div>
                    {actionError && (
                        <p className="mt-2 text-xs text-[var(--destructive)]">
                            {actionError}
                        </p>
                    )}
                </div>
            </Link>

            {menuOpen && (
                <ProjectActionMenu
                    anchorRef={menuButtonRef}
                    onClose={() => setMenuOpen(false)}
                    isPinned={isPinned}
                    onTogglePin={handleTogglePin}
                    onRename={() => {
                        setMenuOpen(false);
                        setIsRenaming(true);
                    }}
                    onArchive={requestArchive}
                />
            )}

            {archiveDialogOpen && (
                <ConfirmDialog
                    title="Archive this project?"
                    description={
                        <>
                            <span className="font-medium text-white">
                                {project.name}
                            </span>{" "}
                            will move to the archived list. You can restore
                            it at any time.
                        </>
                    }
                    confirmLabel="Archive"
                    destructive
                    busy={isArchiving}
                    onConfirm={confirmArchive}
                    onClose={() => setArchiveDialogOpen(false)}
                />
            )}
        </>
    );
}

