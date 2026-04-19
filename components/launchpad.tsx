"use client";

/**
 * Launchpad — Spotlight-style command palette.
 *
 * Triggered by the "Get Started" nav button or ⌘K / Ctrl+K. Built on
 * Radix Dialog primitives for focus trapping + a11y. Items are color-
 * coded so destinations are scannable; when no search result matches,
 * we offer to hand the query to Auteur instead of a dead-end empty
 * state.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";

// ─── Destination registry ───────────────────────────────────────────────────

interface LaunchpadItem {
    id: string;
    title: string;
    subtitle: string;
    href: string;
    actionLabel: string;
    /** Tailwind bg + text classes for the icon tile. */
    iconColor: string;
    icon: React.ReactNode;
}

const LAUNCHPAD_ITEMS: LaunchpadItem[] = [
    {
        id: "auteur",
        title: "Auteur",
        subtitle: "AI creative assistant",
        href: "/auteur",
        actionLabel: "Ask",
        iconColor: "bg-purple-500/12 text-purple-300",
        icon: (
            <svg width="24" height="24" viewBox="0 0 22 22" fill="none">
                <path d="M15.5129 0.846191H6.48722C3.37337 0.846191 0.846191 3.37337 0.846191 6.48722V15.5129C0.846191 18.6267 3.37337 21.1539 6.48722 21.1539H15.5129C18.6267 21.1539 21.1539 18.6267 21.1539 15.5129V6.48722C21.1539 3.37337 18.6267 0.846191 15.5129 0.846191Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 9V13" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" className="auteur-eye-open" />
                <path d="M14 9V13" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" className="auteur-eye-open" />
                <path d="M8 10V11" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" className="auteur-eye-closed" />
                <path d="M14 10V11" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" className="auteur-eye-closed" />
            </svg>
        ),
    },
    {
        id: "studio",
        title: "Studio",
        subtitle: "Your projects and generations",
        href: "/studio",
        actionLabel: "Open",
        iconColor: "bg-sky-500/12 text-sky-300",
        icon: (
            <svg width="24" height="24" viewBox="0 0 31 29" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="M29.909 12.6187H1.40347C1.07709 12.6187 0.8125 12.8827 0.8125 13.2083V27.4104C0.8125 27.7361 1.07709 28 1.40347 28H29.909C30.2354 28 30.5 27.7361 30.5 27.4104V13.2083C30.5 12.8827 30.2354 12.6187 29.909 12.6187Z" />
                <path transform="translate(0 -0.8)" d="M1.98245 12.142L29.3924 8.1487C29.9012 8.07358 30.2481 7.60548 30.1787 7.09692L29.3346 1.2948C29.2594 0.786245 28.7911 0.439504 28.2824 0.508852L1.29445 4.44436C0.814588 4.51371 0.4677 4.94135 0.502389 5.42679L0.924436 11.2925C0.964907 11.8299 1.45055 12.2229 1.98245 12.142Z" />
            </svg>
        ),
    },
    {
        id: "credits",
        title: "Credits",
        subtitle: "Balance and transaction history",
        href: "/credits",
        actionLabel: "Open",
        iconColor: "bg-amber-400/15 text-amber-300",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
        ),
    },
    {
        id: "pricing",
        title: "Pricing",
        subtitle: "Plans and upgrades",
        href: "/pricing",
        actionLabel: "Open",
        iconColor: "bg-rose-500/12 text-rose-300",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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
    "group flex w-full items-center gap-3.5 rounded-[14px] px-3 py-2.5";
const ROW_INTERACTIVE_CLASSES = `${ROW_LAYOUT_CLASSES} transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline-none active:scale-[0.98]`;

// ─── Presentational helpers ─────────────────────────────────────────────────

function LaunchpadRowContent({
    item,
    titleOverride,
    subtitleOverride,
    actionLabelOverride,
    actionLabelAlwaysVisible = false,
}: {
    item: LaunchpadItem;
    titleOverride?: string;
    /** Pass `null` to hide the subtitle entirely. */
    subtitleOverride?: string | null;
    actionLabelOverride?: string;
    actionLabelAlwaysVisible?: boolean;
}) {
    const title = titleOverride ?? item.title;
    const subtitle =
        subtitleOverride === null
            ? null
            : (subtitleOverride ?? item.subtitle);
    const actionLabel = actionLabelOverride ?? item.actionLabel;

    return (
        <>
            <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl max-sm:h-11 max-sm:w-11 max-sm:rounded-[11px] ${item.iconColor}`}
            >
                {item.icon}
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-start justify-center">
                <span className="max-w-full truncate text-[15px] font-semibold leading-snug text-white">
                    {title}
                </span>
                {subtitle !== null && (
                    <span className="mt-0.5 max-w-full truncate text-[12px] text-[#a1a1aa]">
                        {subtitle}
                    </span>
                )}
            </div>
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

// ─── Component ──────────────────────────────────────────────────────────────

interface LaunchpadProps {
    open: boolean;
    onClose: () => void;
}

export function Launchpad({ open, onClose }: LaunchpadProps) {
    const [search, setSearch] = useState("");
    const searchRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    useEffect(() => {
        if (!open) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- clear query on close so the next open starts fresh
            setSearch("");
        }
    }, [open]);

    const navigate = useCallback(
        (href: string) => {
            onClose();
            router.push(href);
        },
        [onClose, router],
    );

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
        <DialogPrimitive.Root
            open={open}
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="launchpad-overlay fixed inset-0 z-[80] bg-black/40 backdrop-blur-xl" />
                <DialogPrimitive.Content
                    onOpenAutoFocus={(e) => {
                        e.preventDefault();
                        searchRef.current?.focus();
                    }}
                    className="launchpad-content fixed left-1/2 top-1/2 z-[81] w-[calc(100%-32px)] max-w-[580px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[20px] border border-white/[0.08] bg-[rgba(22,22,24,0.85)] shadow-[0_24px_48px_rgba(0,0,0,0.25),0_48px_80px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] outline-none backdrop-blur-[40px] backdrop-saturate-150 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:bottom-0 max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom,0px)]"
                >
                    <DialogPrimitive.Title className="sr-only">
                        Launchpad
                    </DialogPrimitive.Title>

                    {/* Search */}
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
                        <span className="hidden select-none rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[#a1a1aa] sm:block">
                            ESC
                        </span>
                    </div>

                    {/* Inset divider — floats inside the card instead of
                        running edge-to-edge. */}
                    <div className="mx-5 h-px bg-white/[0.06] max-sm:mx-4" />

                    {/* List — grid overlay: invisible baseline sets a stable
                        height from the full registry so the card doesn't
                        jump as the filter narrows. */}
                    <div className="grid max-h-[60vh] overflow-y-auto p-2 max-sm:max-h-[55svh]">
                        <ul
                            aria-hidden
                            className="invisible col-start-1 row-start-1"
                        >
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
                                            onClick={() => navigate(item.href)}
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
                                            navigate(
                                                buildAuteurQueryHref(
                                                    trimmedQuery,
                                                ),
                                            )
                                        }
                                        className={ROW_INTERACTIVE_CLASSES}
                                    >
                                        <LaunchpadRowContent
                                            item={auteurItem}
                                            titleOverride={`\u201C${trimmedQuery}\u201D`}
                                            subtitleOverride={null}
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
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

// ─── Keyboard shortcut hook ─────────────────────────────────────────────────

export function useLaunchpadShortcut(): [boolean, (v: boolean) => void] {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setOpen((o) => !o);
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    return [open, setOpen];
}
