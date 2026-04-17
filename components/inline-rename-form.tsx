"use client";

/**
 * InlineRenameForm — in-place rename control.
 *
 * Replaces the static title with `[input] [✓] [✗]`, autofocused and
 * text-selected so the user can type straight over the old name.
 *
 * Interactions:
 *   • Enter  — save
 *   • Escape — cancel
 *   • ✓      — save
 *   • ✗      — cancel
 *
 * `onSave` returns an error message (string) to display inline, or
 * `null` on success. The parent is responsible for unmounting the
 * form on success (e.g. by toggling its `isEditing` flag).
 *
 * Click + mousedown inside the form are swallowed so the form works
 * correctly when rendered inside a `<Link>` wrapper (the studio card
 * case) — navigation won't fire when the user clicks the input or
 * the save/cancel buttons.
 */

import { useEffect, useRef, useState } from "react";

import { CheckIcon, CloseIcon } from "@/components/icons/action-icons";

export interface InlineRenameFormProps {
    initialName: string;
    /** Returns an error message string to display, or `null` on success. */
    onSave: (newName: string) => Promise<string | null>;
    onCancel: () => void;
    maxLength?: number;
    /** Visual size. `sm` = studio card (h-8 text-sm). `md` = page
     *  header where the title itself is larger (h-9 text-lg). */
    size?: "sm" | "md";
}

const SIZE_CLASSES = {
    sm: {
        row: "h-8",
        input: "h-8 px-2.5 text-sm font-semibold",
        button: "h-8 w-8",
        icon: 16,
    },
    md: {
        row: "h-9",
        input: "h-9 px-3 text-lg font-semibold",
        button: "h-9 w-9",
        icon: 18,
    },
} as const;

export function InlineRenameForm({
    initialName,
    onSave,
    onCancel,
    maxLength,
    size = "sm",
}: InlineRenameFormProps) {
    const [value, setValue] = useState(initialName);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    async function handleSave() {
        if (isSaving) return;
        setIsSaving(true);
        setError("");
        const message = await onSave(value);
        if (message) {
            setError(message);
            setIsSaving(false);
            // Re-focus so the user can correct and retry.
            inputRef.current?.focus();
        }
        // On success the parent unmounts this form — no cleanup needed.
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
        } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
        }
    }

    // When this form is rendered inside a <Link> (studio card), any
    // click inside would navigate. Stop the event so the input and
    // action buttons behave as expected.
    const swallow = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const cls = SIZE_CLASSES[size];

    return (
        <div
            className={`flex w-full items-center gap-1 ${cls.row}`}
            onClick={swallow}
            onMouseDown={swallow}
        >
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => {
                    setValue(e.target.value);
                    if (error) setError("");
                }}
                onKeyDown={handleKeyDown}
                maxLength={maxLength}
                disabled={isSaving}
                aria-label="Project name"
                aria-invalid={error ? true : undefined}
                className={`min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.06] text-white outline-none transition-colors focus:border-white/30 disabled:opacity-50 ${cls.input}`}
            />
            <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                aria-label="Save"
                className={`flex shrink-0 items-center justify-center rounded-lg text-[#9ca3af] transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50 ${cls.button}`}
            >
                <CheckIcon size={cls.icon} />
            </button>
            <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                aria-label="Cancel"
                className={`flex shrink-0 items-center justify-center rounded-lg text-[#9ca3af] transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50 ${cls.button}`}
            >
                <CloseIcon size={cls.icon} />
            </button>
            {error && (
                <span
                    role="alert"
                    className="ml-1 truncate text-[11px] text-[var(--destructive)]"
                >
                    {error}
                </span>
            )}
        </div>
    );
}
