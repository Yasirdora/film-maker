"use client";

/**
 * ProjectSettings — inline project management controls.
 *
 * Provides rename (editable title) and archive (with confirmation)
 * for the project detail page. No modal — interactions happen inline
 * for minimal friction.
 */

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface ProjectSettingsProps {
    uid: string;
    name: string;
    description: string | null;
}

export function ProjectSettings({ uid, name, description }: ProjectSettingsProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(name);
    const [isSaving, setIsSaving] = useState(false);
    const [showArchive, setShowArchive] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [error, setError] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    async function handleSave() {
        const trimmed = editName.trim();
        if (!trimmed || trimmed === name) {
            setIsEditing(false);
            setEditName(name);
            return;
        }

        setError("");
        setIsSaving(true);

        try {
            const res = await fetch(`/api/projects/${uid}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed }),
            });

            if (!res.ok) {
                const data = (await res.json()) as { error?: string };
                setError(data.error ?? "Failed to rename");
                setIsSaving(false);
                return;
            }

            setIsEditing(false);
            router.refresh();
        } catch {
            setError("Something went wrong.");
        } finally {
            setIsSaving(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
        }
        if (e.key === "Escape") {
            setIsEditing(false);
            setEditName(name);
        }
    }

    async function handleArchive() {
        setIsArchiving(true);

        try {
            const res = await fetch(`/api/projects/${uid}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const data = (await res.json()) as { error?: string };
                setError(data.error ?? "Failed to archive");
                setIsArchiving(false);
                setShowArchive(false);
                return;
            }

            router.push("/studio");
        } catch {
            setError("Something went wrong.");
            setIsArchiving(false);
            setShowArchive(false);
        }
    }

    return (
        <div className="min-w-0">
            {/* Editable title */}
            {isEditing ? (
                <div className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSave}
                        maxLength={100}
                        disabled={isSaving}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-lg font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:opacity-50"
                    />
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="group flex items-center gap-1.5 truncate text-left"
                    title="Click to rename"
                >
                    <h1 className="truncate text-[14px] font-semibold text-white sm:text-lg">
                        {name}
                    </h1>
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 text-[#52525b] opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden
                    >
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                </button>
            )}

            {description && (
                <p className="mt-1 text-sm text-[#9ca3af]">
                    {description}
                </p>
            )}

            {error && (
                <p className="mt-1 text-sm text-[var(--destructive)]">
                    {error}
                </p>
            )}

            {/* Archive confirmation */}
            {showArchive ? (
                <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-[#9ca3af]">
                        Archive this project?
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleArchive}
                        disabled={isArchiving}
                    >
                        {isArchiving ? "Archiving…" : "Yes, archive"}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowArchive(false)}
                        disabled={isArchiving}
                    >
                        Cancel
                    </Button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setShowArchive(true)}
                    className="mt-2 text-xs text-neutral-400 underline underline-offset-2 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                >
                    Archive project
                </button>
            )}
        </div>
    );
}
