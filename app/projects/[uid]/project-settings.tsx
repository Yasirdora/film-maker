"use client";

/**
 * ProjectSettings — project header with inline rename + action menu.
 *
 * Three interactions, all available from this single component:
 *   • Click the title — swaps in the shared `InlineRenameForm`
 *     (`[input] [✓] [✗]`), matching the studio card exactly.
 *   • ⋯ menu — Pin / Rename / Archive. "Rename" just triggers the
 *     same inline edit, so users who discover the menu still get the
 *     direct-edit UX.
 *   • Archive — opens a themed `ConfirmDialog` and, on success,
 *     sends the user back to /studio.
 *
 * Rename + archive network work lives here; the rename form itself
 * is generic and shared across the app.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DotsIcon } from "@/components/icons/action-icons";
import { InlineRenameForm } from "@/components/inline-rename-form";
import { ProjectActionMenu } from "@/components/project-action-menu";
import { MAX_PROJECT_NAME_LENGTH } from "@/lib/projects";

interface ProjectSettingsProps {
    uid: string;
    name: string;
    description: string | null;
    pinnedAt: number | null;
}

export function ProjectSettings({
    uid,
    name,
    description,
    pinnedAt,
}: ProjectSettingsProps) {
    const [isRenaming, setIsRenaming] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [error, setError] = useState("");
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const router = useRouter();

    const isPinned = pinnedAt !== null;

    /**
     * Persists a new name. Returned error string bubbles back into
     * the `InlineRenameForm` so it can display inline validation
     * failures without the parent needing to manage that state.
     */
    async function handleRename(newName: string): Promise<string | null> {
        const trimmed = newName.trim();
        if (!trimmed) return "Name is required";
        if (trimmed === name) {
            setIsRenaming(false);
            return null;
        }
        try {
            const res = await fetch(`/api/projects/${uid}`, {
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
            router.refresh();
            return null;
        } catch {
            return "Something went wrong. Please try again.";
        }
    }

    async function handleTogglePin() {
        setMenuOpen(false);
        setError("");
        const endpoint = isPinned ? "unpin" : "pin";
        try {
            const res = await fetch(`/api/projects/${uid}/${endpoint}`, {
                method: "POST",
            });
            if (!res.ok) {
                setError(isPinned ? "Failed to unpin." : "Failed to pin.");
                return;
            }
            router.refresh();
        } catch {
            setError("Something went wrong.");
        }
    }

    function requestArchive() {
        setMenuOpen(false);
        setError("");
        setArchiveDialogOpen(true);
    }

    async function confirmArchive() {
        if (isArchiving) return;
        setIsArchiving(true);
        try {
            const res = await fetch(`/api/projects/${uid}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                setError("Failed to archive.");
                setArchiveDialogOpen(false);
                return;
            }
            // Leave the archived project's page — the project no
            // longer belongs in /projects/[uid] once archived.
            router.push("/studio");
        } catch {
            setError("Something went wrong.");
            setArchiveDialogOpen(false);
        } finally {
            setIsArchiving(false);
        }
    }

    return (
        <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
                {isRenaming ? (
                    // Cap the form width so it stays close to the
                    // length of a typical project name instead of
                    // stretching across the whole header row.
                    <div className="min-w-0 flex-1 sm:max-w-sm">
                        <InlineRenameForm
                            initialName={name}
                            onSave={handleRename}
                            onCancel={() => setIsRenaming(false)}
                            maxLength={MAX_PROJECT_NAME_LENGTH}
                            size="sm"
                        />
                    </div>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={() => setIsRenaming(true)}
                            title="Click to rename"
                            className="group flex min-w-0 items-center gap-1.5 truncate text-left"
                        >
                            <h1 className="truncate text-sm font-semibold text-white sm:text-base">
                                {name}
                            </h1>
                        </button>
                        <button
                            ref={menuButtonRef}
                            type="button"
                            onClick={() => setMenuOpen((prev) => !prev)}
                            aria-label="Project actions"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ws-icon transition-colors hover:bg-white/[0.06] hover:text-white"
                        >
                            <DotsIcon size={18} className="rotate-90" />
                        </button>
                    </>
                )}
            </div>

            {description && !isRenaming && (
                <p className="mt-1 text-sm text-ws-icon">{description}</p>
            )}

            {error && (
                <p className="mt-1 text-sm text-[var(--destructive)]">{error}</p>
            )}

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
                            <span className="font-medium text-white">{name}</span>{" "}
                            will move to the archived list. You can restore it
                            at any time.
                        </>
                    }
                    confirmLabel="Archive"
                    destructive
                    busy={isArchiving}
                    onConfirm={confirmArchive}
                    onClose={() => setArchiveDialogOpen(false)}
                />
            )}
        </div>
    );
}
