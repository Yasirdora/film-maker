"use client";

/**
 * Launchpad — Spotlight-style command palette.
 *
 * Triggered by the "Get Started" nav button or ⌘K / Ctrl+K. Built on
 * Radix Dialog primitives for focus trapping + a11y. When no search
 * result matches, we offer to hand the query to Auteur instead of a
 * dead-end empty state.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";

import { AuteurIcon } from "./icons/auteur-icon";

// ─── Destination registry ───────────────────────────────────────────────────

interface LaunchpadItem {
    id: string;
    title: string;
    subtitle: string;
    href: string;
    actionLabel: string;
    icon: React.ReactNode;
}

const LAUNCHPAD_ITEMS: LaunchpadItem[] = [
    {
        id: "auteur",
        title: "Auteur",
        subtitle: "AI creative assistant",
        href: "/auteur",
        actionLabel: "Ask",
        icon: <AuteurIcon />,
    },
    {
        id: "studio",
        title: "Studio",
        subtitle: "Your projects and generations",
        href: "/studio",
        actionLabel: "Open",
        icon: (
            <svg width="20" height="20" viewBox="0 0 31 29" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M29.909 12.6187H1.40347C1.07709 12.6187 0.8125 12.8827 0.8125 13.2083V27.4104C0.8125 27.7361 1.07709 28 1.40347 28H29.909C30.2354 28 30.5 27.7361 30.5 27.4104V13.2083C30.5 12.8827 30.2354 12.6187 29.909 12.6187Z" />
                <path transform="translate(0 -0.8)" d="M1.98245 12.142L29.3924 8.1487C29.9012 8.07358 30.2481 7.60548 30.1787 7.09692L29.3346 1.2948C29.2594 0.786245 28.7911 0.439504 28.2824 0.508852L1.29445 4.44436C0.814588 4.51371 0.4677 4.94135 0.502389 5.42679L0.924436 11.2925C0.964907 11.8299 1.45055 12.2229 1.98245 12.142Z" />
            </svg>
        ),
    },
    {
        id: "credits",
        title: "Apps",
        subtitle: "Balance and transaction history",
        href: "/credits",
        actionLabel: "Open",
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
        ),
    },
    {
        id: "tools",
        title: "Tools",
        subtitle: "Video, audio & image editors",
        href: "/editor",
        actionLabel: "Open",
        /* Lucide-style wrench — the universal "tools" mark, and the
           closest match in tone to the other monochrome outline icons
           in the list. */
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
        ),
    },
    {
        id: "pricing",
        title: "Subscription",
        subtitle: "Plans and upgrades",
        href: "/pricing",
        actionLabel: "Open",
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M16 8h-6a2 2 0 100 4h4a2 2 0 110 4H8" />
                <path d="M12 18V6" />
            </svg>
        ),
    },
];

// Row layout shared between the interactive list and the invisible
// baseline phantom. Extracted so their heights stay in lockstep, which
// prevents the card from shrinking as the user narrows the filter.
const ROW_LAYOUT_CLASSES =
    "group flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2";
const ROW_INTERACTIVE_CLASSES = `${ROW_LAYOUT_CLASSES} transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline-none active:scale-[0.98]`;

// ─── Presentational helpers ─────────────────────────────────────────────────

function LaunchpadRowContent({
    item,
    titleOverride,
    actionLabelOverride,
    actionLabelAlwaysVisible = false,
}: {
    item: LaunchpadItem;
    titleOverride?: string;
    actionLabelOverride?: string;
    actionLabelAlwaysVisible?: boolean;
}) {
    const title = titleOverride ?? item.title;
    const actionLabel = actionLabelOverride ?? item.actionLabel;

    return (
        <>
            {/* Monochrome inline icon — no tile, no per-item colour.
                Inherits a single neutral text colour from this slot so
                every row in the list reads as part of the same family
                (the prior coloured tiles made the list feel like a
                grid of categories rather than a clean command list). */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center text-[#a1a1aa] transition-colors group-hover:text-white group-focus-visible:text-white">
                {item.icon}
            </div>
            {/* Title + inline subtitle on one line, separated by tone
                only — no slash or other glyph. The bright title carries
                the meaning, the dim subtitle adds optional context
                (this is the pattern Raycast / Linear use). `text-left`
                is required because the parent row is a `<button>`,
                and HTML buttons default to `text-align: center`. */}
            <span className="min-w-0 flex-1 truncate text-left text-[14px] font-light">
                <span className="text-white">{title}</span>
                {item.subtitle && (
                    <span className="ml-2 text-[12px] text-white/40">
                        {item.subtitle}
                    </span>
                )}
            </span>
            <span
                className={`shrink-0 text-[12px] font-semibold text-[#a1a1aa] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${
                    actionLabelAlwaysVisible ? "opacity-100" : "opacity-0"
                }`}
            >
                {actionLabel}
            </span>
        </>
    );
}

function buildAuteurQueryHref(query: string): string {
    return `/auteur?q=${encodeURIComponent(query)}`;
}

// ─── Result list ────────────────────────────────────────────────────────────
//
// Pure presentation, takes its query from a parent. Lives as its own
// component so the dialog body can compose a search input + this list
// without duplicating the filtering / "ask Auteur" fallback logic.

interface LaunchpadListProps {
    search: string;
    onNavigate: (href: string) => void;
}

function LaunchpadList({ search, onNavigate }: LaunchpadListProps) {
    const trimmedQuery = search.trim();
    const filtered = LAUNCHPAD_ITEMS.filter((item) => {
        const q = search.toLowerCase();
        return (
            item.title.toLowerCase().includes(q) ||
            item.subtitle.toLowerCase().includes(q)
        );
    });

    const auteurItem = LAUNCHPAD_ITEMS.find((item) => item.id === "auteur");
    const showAskAuteur =
        filtered.length === 0 && trimmedQuery.length > 0 && auteurItem !== undefined;

    return (
        // Grid overlay: invisible baseline sets a stable height from the
        // full registry so the panel doesn't jump as the filter narrows.
        <div className="grid max-h-[60vh] overflow-y-auto p-2 max-sm:max-h-[55svh]">
            <ul aria-hidden className="invisible col-start-1 row-start-1">
                {LAUNCHPAD_ITEMS.map((item) => (
                    <li key={item.id}>
                        <div className={ROW_LAYOUT_CLASSES}>
                            <LaunchpadRowContent item={item} />
                        </div>
                    </li>
                ))}
            </ul>

            <ul className="col-start-1 row-start-1">
                {filtered.length > 0 ? (
                    filtered.map((item) => (
                        <li key={item.id}>
                            <button
                                type="button"
                                onClick={() => onNavigate(item.href)}
                                className={ROW_INTERACTIVE_CLASSES}
                            >
                                <LaunchpadRowContent item={item} />
                            </button>
                        </li>
                    ))
                ) : showAskAuteur && auteurItem ? (
                    <li>
                        <button
                            type="button"
                            onClick={() =>
                                onNavigate(buildAuteurQueryHref(trimmedQuery))
                            }
                            className={ROW_INTERACTIVE_CLASSES}
                        >
                            <LaunchpadRowContent
                                item={auteurItem}
                                titleOverride={`“${trimmedQuery}”`}
                                actionLabelOverride="Ask Auteur AI"
                                actionLabelAlwaysVisible
                            />
                        </button>
                    </li>
                ) : (
                    <li className="py-7 text-center text-[14px] text-[#a1a1aa]">
                        No results found
                    </li>
                )}
            </ul>
        </div>
    );
}

// ─── Dialog body ────────────────────────────────────────────────────────────
//
// Embeds the search input above the result list. Shared by every
// surface that opens the Launchpad (desktop centered modal and mobile
// bottom-sheet are both the same Dialog, just sized differently in CSS).

interface LaunchpadBodyProps {
    onClose: () => void;
}

function LaunchpadBody({ onClose }: LaunchpadBodyProps) {
    const [search, setSearch] = useState("");
    const searchRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // The dialog unmounts on close, so this runs once per open. Touch
    // devices skip auto-focus — the virtual keyboard would obscure the
    // bottom-docked sheet.
    useEffect(() => {
        if (
            typeof window !== "undefined" &&
            window.matchMedia("(hover: none)").matches
        ) {
            return;
        }
        searchRef.current?.focus();
    }, []);

    const handleNavigate = useCallback(
        (href: string) => {
            onClose();
            router.push(href);
        },
        [onClose, router],
    );

    return (
        <>
            <div className="flex items-center gap-3.5 px-5 py-4 max-sm:px-4">
                <svg
                    className="shrink-0 text-[#a1a1aa]"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Where do you want to go?"
                    className="flex-1 bg-transparent text-[17px] font-medium text-white outline-none placeholder:font-normal placeholder:text-[#71717a] max-sm:text-[16px]"
                    autoComplete="off"
                />
            </div>

            <div className="mx-5 h-px bg-white/[0.06] max-sm:mx-4" />

            <LaunchpadList search={search} onNavigate={handleNavigate} />
        </>
    );
}

// ─── Surfaces ───────────────────────────────────────────────────────────────

interface LaunchpadProps {
    open: boolean;
    onClose: () => void;
}

/**
 * The Launchpad surface. Renders as a centered modal on desktop and a
 * bottom-sheet on mobile (the responsive sizing is in the Content
 * className below). Both share the same `LaunchpadBody`.
 */
export function Launchpad({ open, onClose }: LaunchpadProps) {
    return (
        <DialogPrimitive.Root
            open={open}
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="launchpad-overlay fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm" />
                <DialogPrimitive.Content
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    className="launchpad-content fixed left-1/2 top-1/2 z-[81] w-[calc(100%-32px)] max-w-[580px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[20px] border border-white/[0.08] bg-[rgba(22,22,24,0.85)] shadow-[0_24px_48px_rgba(0,0,0,0.25),0_48px_80px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] outline-none backdrop-blur-[40px] backdrop-saturate-150 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:bottom-0 max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom,0px)]"
                >
                    <DialogPrimitive.Title className="sr-only">
                        Launchpad
                    </DialogPrimitive.Title>
                    <LaunchpadBody onClose={onClose} />
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

