"use client";

/**
 * ProjectActionMenu — Pin / Rename / Archive dropdown.
 *
 * Shared between the studio card's ⋯ trigger and the project page's
 * header so both surfaces present the same options, ordering,
 * keyboard behaviour, and visual styling.
 *
 * The menu is portal-rendered with `fixed` positioning measured from
 * the trigger's bounding rect — that way it escapes any `overflow`
 * clipping on its ancestors and its own `backdrop-blur` isn't
 * trapped by a parent blur stacking context. The horizontal position
 * is clamped so triggers near the viewport edge don't push the menu
 * off-screen.
 *
 * Dismiss handlers (outside click + Escape) are registered inside a
 * `setTimeout` so the click that opens the menu doesn't immediately
 * close it.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
    ArchiveIcon,
    EditIcon,
    PinIcon,
} from "@/components/icons/action-icons";

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
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(
        null,
    );

    useLayoutEffect(() => {
        function measure() {
            const anchor = anchorRef.current;
            if (!anchor) return;
            const rect = anchor.getBoundingClientRect();
            const maxLeft = window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN;
            const preferredLeft = rect.right - MENU_WIDTH;
            const left = Math.max(
                VIEWPORT_MARGIN,
                Math.min(preferredLeft, maxLeft),
            );
            setPosition({ top: rect.bottom + MENU_GAP, left });
        }
        measure();
        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, true);
        return () => {
            window.removeEventListener("resize", measure);
            window.removeEventListener("scroll", measure, true);
        };
    }, [anchorRef]);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            const target = e.target as Node;
            if (menuRef.current?.contains(target)) return;
            if (anchorRef.current?.contains(target)) return;
            onClose();
        }
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        const timer = setTimeout(() => {
            document.addEventListener("mousedown", handleClick);
            document.addEventListener("keydown", handleKey);
        }, 0);
        return () => {
            clearTimeout(timer);
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKey);
        };
    }, [anchorRef, onClose]);

    if (!position) return null;

    return createPortal(
        <div
            ref={menuRef}
            role="menu"
            style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                width: MENU_WIDTH,
                zIndex: 60,
            }}
            className="overflow-hidden rounded-xl bg-[#1a1a1c]/95 p-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.08] backdrop-blur-xl"
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
