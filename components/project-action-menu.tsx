"use client";

/**
 * ProjectActionMenu — Pin / Rename / Archive dropdown.
 *
 * Shared between the studio card's ⋯ trigger and the project page's
 * header so both surfaces present the same options, ordering,
 * keyboard behaviour, and visual styling.
 *
 * Portal-rendered with `fixed` positioning measured from the
 * trigger's bounding rect. Anchor tracking, outside-click dismissal,
 * and Escape handling are delegated to `usePopover`.
 */

import { createPortal } from "react-dom";

import {
    ArchiveIcon,
    EditIcon,
    PinIcon,
} from "@/components/icons/action-icons";
import { usePopover } from "@/lib/use-popover";

const MENU_WIDTH = 180;
const MENU_GAP = 4;
const VIEWPORT_MARGIN = 24;

export interface ProjectActionMenuProps {
    /** Element the menu should visually anchor to (the ⋯ button). */
    anchorRef: React.RefObject<HTMLElement | null>;
    onClose: () => void;
    isPinned: boolean;
    onTogglePin: () => void;
    onRename: () => void;
    onArchive: () => void;
}

export function ProjectActionMenu({
    anchorRef,
    onClose,
    isPinned,
    onTogglePin,
    onRename,
    onArchive,
}: ProjectActionMenuProps) {
    // This component is only mounted when open (the parent gates
    // rendering), so `open` is always `true` here.
    const { anchorRect, menuRef } = usePopover({
        open: true,
        onClose,
        anchorRef,
    });

    if (!anchorRect) return null;

    // Clamp the horizontal position so triggers near the viewport
    // edge don't push the menu off-screen.
    const maxLeft = window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN;
    const preferredLeft = anchorRect.right - MENU_WIDTH;
    const left = Math.max(VIEWPORT_MARGIN, Math.min(preferredLeft, maxLeft));

    return createPortal(
        <div
            ref={menuRef}
            role="menu"
            style={{
                position: "fixed",
                top: anchorRect.bottom + MENU_GAP,
                left,
                width: MENU_WIDTH,
                zIndex: 60,
            }}
            className="overflow-hidden rounded-xl bg-ws-surface/95 p-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.08] backdrop-blur-xl"
        >
            <MenuItem onClick={onTogglePin} icon={<PinIcon size={14} />}>
                {isPinned ? "Unpin" : "Pin"}
            </MenuItem>
            <MenuItem onClick={onRename} icon={<EditIcon size={14} />}>
                Rename
            </MenuItem>
            <div className="my-1 h-px bg-white/[0.06]" role="separator" />
            <MenuItem
                onClick={onArchive}
                icon={<ArchiveIcon size={14} />}
                destructive
            >
                Archive
            </MenuItem>
        </div>,
        document.body,
    );
}

function MenuItem({
    onClick,
    icon,
    destructive,
    children,
}: {
    onClick: () => void;
    icon: React.ReactNode;
    destructive?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-white/[0.06] ${
                destructive ? "text-[var(--destructive)]" : "text-white"
            }`}
        >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {icon}
            </span>
            {children}
        </button>
    );
}
