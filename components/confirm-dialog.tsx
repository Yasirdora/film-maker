"use client";

/**
 * ConfirmDialog — themed replacement for `window.confirm`.
 *
 * Renders a centered modal via React portal with a title, optional
 * description, and explicit cancel / confirm actions. Closes on
 * Escape, overlay click, or Cancel. While `busy` is true (action
 * in flight) interactions that would dismiss the dialog are blocked
 * so the user can't double-fire or abandon a pending request.
 *
 * Styling matches the studio dark theme regardless of the OS
 * `prefers-color-scheme`, since the studio and project surfaces are
 * always dark.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
    /** Short, direct question — e.g. "Archive project?". */
    title: string;
    /** Optional body text explaining the consequence. */
    description?: React.ReactNode;
    /** Label for the primary action. Defaults to "Confirm". */
    confirmLabel?: string;
    /** Label for the cancel action. Defaults to "Cancel". */
    cancelLabel?: string;
    /** Render the primary action in a destructive tone (red). */
    destructive?: boolean;
    /** When true, dismiss handlers are disabled and the primary
     *  button shows a loading state. */
    busy?: boolean;
    onConfirm: () => void | Promise<void>;
    onClose: () => void;
}

export function ConfirmDialog({
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = false,
    busy = false,
    onConfirm,
    onClose,
}: ConfirmDialogProps) {
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape" && !busy) onClose();
        }
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [busy, onClose]);

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onMouseDown={(e) => {
                // Dismiss on overlay click only (not drags from inside),
                // and not while a request is in flight.
                if (e.target === e.currentTarget && !busy) onClose();
            }}
        >
            <div
                className="w-full max-w-md rounded-2xl bg-[#1a1a1c] p-6 text-white shadow-[0_24px_48px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.08]"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <h2
                    id="confirm-dialog-title"
                    className="text-base font-semibold"
                >
                    {title}
                </h2>
                {description && (
                    <div className="mt-2 text-sm text-[#9ca3af]">
                        {description}
                    </div>
                )}
                <div className="mt-6 flex items-center justify-end gap-2">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={busy}
                        // Studio is always dark, so force the dark
                        // ghost styling regardless of OS preference.
                        className="text-white hover:bg-white/[0.08]"
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={onConfirm}
                        disabled={busy}
                        className={
                            destructive
                                ? "bg-[var(--destructive)] text-white hover:bg-[var(--destructive)]/90 dark:bg-[var(--destructive)] dark:text-white dark:hover:bg-[var(--destructive)]/90"
                                : "bg-white text-black hover:bg-neutral-200 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                        }
                    >
                        {busy ? "Working…" : confirmLabel}
                    </Button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
