"use client";

/**
 * PageKebabMenu — page-level kebab next to the PageBar's badge.
 *
 * Reserved slot for tool-specific page actions (clear project, export
 * settings, recent files, etc.) so every editor has the same hand to
 * reach for when it needs to surface a menu that isn't a single
 * toolbar button.
 *
 * The component is intentionally thin: it just owns the kebab button,
 * outside-click / Escape close behavior, and the `ui-menu` surface.
 * Items are passed in as children — each editor composes its own row
 * set using the canonical `.ui-menu-item` / `.ui-menu-item-danger` /
 * `.ui-menu-divider` classes, identical to every other menu in the
 * product.
 *
 * Clicking inside the dropdown auto-closes it (the `onClick` handler
 * on the menu surface fires *after* any inner button's `onClick`, so
 * the item action runs first and the menu hides as a follow-up). To
 * keep a row open after click, the row can `stopPropagation` — but
 * the common case is "click → act → close", which is what users
 * expect from a kebab.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

interface PageKebabMenuProps {
    /** Menu items — usually `.ui-menu-item` buttons, dividers, etc. */
    children: ReactNode;
    /** Tooltip + accessible label for the trigger. Defaults to "More". */
    label?: string;
}

export default function PageKebabMenu({
    children,
    label = "More",
}: PageKebabMenuProps) {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    /* Close on outside click / Escape. Kept inside the component so
       every consumer gets the behavior for free. */
    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (!wrapperRef.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div ref={wrapperRef} className="relative inline-flex items-center">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={label}
                title={label}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-white/55 hover:text-white hover:bg-white/[0.06] data-[active]:bg-white/[0.06] transition-colors"
                data-active={open || undefined}
            >
                <KebabGlyph />
            </button>
            {open && (
                <div
                    role="menu"
                    /* `onClick={() => setOpen(false)}` lets every inner
                       button auto-close the menu after its handler
                       fires (events bubble up). Rows that need to keep
                       the menu open can `stopPropagation`. */
                    onClick={() => setOpen(false)}
                    className="ui-menu absolute left-0 top-full mt-1.5 z-50"
                    style={{ minWidth: 200 }}
                >
                    {children}
                </div>
            )}
        </div>
    );
}

function KebabGlyph() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
        >
            <circle cx="12" cy="5" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="12" cy="19" r="1.75" />
        </svg>
    );
}
