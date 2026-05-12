"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** id of the element inside the dialog that labels it (usually the heading). */
  labelledBy?: string;
  /** Disable closing when the user clicks the backdrop. */
  dismissOnBackdropClick?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Native <dialog>-based modal. Provides focus trap, Esc handling, top-layer
 * rendering, and background inertness for free; we layer on body scroll lock,
 * focus restoration, and backdrop-click-to-close.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  dismissOnBackdropClick = true,
  className = "",
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      document.documentElement.style.overflow = "";
      previouslyFocused.current?.focus?.();
      previouslyFocused.current = null;
      onClose();
    };

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      onMouseDown={(e) => {
        if (!dismissOnBackdropClick) return;
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className={`bg-transparent p-0 text-inherit backdrop:bg-black/60 ${className}`}
    >
      {children}
    </dialog>
  );
}

export function ModalPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg bg-[#1c1d20] border border-[#252629] shadow-[0_8px_32px_rgba(0,0,0,0.5)] ${className}`}
    >
      {children}
    </div>
  );
}

export function ModalHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-[#0a0b0d]">
      {children}
    </div>
  );
}

export function ModalBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#0a0b0d]">
      {children}
    </div>
  );
}
