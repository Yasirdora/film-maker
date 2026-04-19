"use client";

/**
 * Launchpad — Spotlight-style command palette.
 *
 * Triggered by the "Apps" nav button or Cmd+K / Ctrl+K keyboard
 * shortcut. Provides searchable access to all app destinations.
 *
 * The UI is two stacked cards (search on top, list below) with a
 * staggered entrance: the list card fades in ~120ms after the search
 * card so the eye lands on the input first.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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
        icon: (
            <svg width="22" height="22" viewBox="0 0 19.5 19.5" fill="none">
                <path d="M13.75 0.75H5.75C2.99 0.75 0.75 2.99 0.75 5.75V13.75C0.75 16.51 2.99 18.75 5.75 18.75H13.75C16.51 18.75 18.75 16.51 18.75 13.75V5.75C18.75 2.99 16.51 0.75 13.75 0.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="5.75" y="6.75" width="2" height="6" rx="1" fill="currentColor" />
                <rect x="11.75" y="6.75" width="2" height="6" rx="1" fill="currentColor" />
            </svg>
        ),
    },
    {
        id: "studio",
        title: "Studio",
        subtitle: "Your projects and generations",
        href: "/studio",
        actionLabel: "Open",
        icon: (
            <svg width="22" height="22" viewBox="0 0 31 29" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
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
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M16 8h-6a2 2 0 100 4h4a2 2 0 110 4H8" />
                <path d="M12 18V6" />
            </svg>
        ),
    },
];

const ICON_TILE_CLASSES =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/80 max-sm:h-10 max-sm:w-10 max-sm:rounded-[10px]";

const CARD_SURFACE_CLASSES =
    "rounded-[20px] border border-white/[0.08] bg-[rgba(22,22,24,0.85)] shadow-[0_24px_48px_rgba(0,0,0,0.25),0_48px_80px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[40px] backdrop-saturate-150";

// Row layout shared between the interactive list and the invisible
// baseline phantom. Extracted so their heights stay in lockstep.
const ROW_LAYOUT_CLASSES =
    "group flex w-full items-center gap-3.5 rounded-[14px] px-3.5 py-3";
const ROW_INTERACTIVE_CLASSES = `${ROW_LAYOUT_CLASSES} transition-colors hover:bg-white/[0.05] active:scale-[0.98]`;

// ─── Presentational helpers ─────────────────────────────────────────────────

/**
 * Renders the inner contents of a launchpad row (icon tile + text block +
 * optional trailing action label). Kept framework-free — the caller wraps
 * this in a <button> for real rows and a <div> for the invisible baseline
 * phantom, so a single source of truth drives row height in both.
 */
function LaunchpadRowContent({
    item,
    titleOverride,
    subtitleOverride,
    actionLabelOverride,
    actionLabelAlwaysVisible = false,
}: {
    item: LaunchpadItem;
    /** Replace the default title (e.g. echo the user's query). */
    titleOverride?: string;
    /** Pass `null` to hide the subtitle entirely. */
    subtitleOverride?: string | null;
    actionLabelOverride?: string;
    /** When true, the trailing action label is visible at rest instead of
     *  only on hover — used for synthetic rows (e.g. Ask Auteur) where the
     *  label itself is the affordance that tells the user what will happen. */
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
            <div className={ICON_TILE_CLASSES}>{item.icon}</div>
            <div className="flex min-w-0 flex-1 flex-col items-start justify-center">
                <span className="max-w-full truncate text-[15px] font-semibold leading-snug text-white">
                    {title}
                </span>
                {subtitle !== null && (
                    <span className="mt-0.5 max-w-full truncate text-[12px] text-[#52525b]">
                        {subtitle}
                    </span>
                )}
            </div>
            <span
                className={`shrink-0 text-[12px] font-semibold text-[#52525b] transition-opacity group-hover:opacity-100 ${
                    actionLabelAlwaysVisible ? "opacity-100" : "opacity-0"
                }`}
            >
                {actionLabel}
            </span>
        </>
    );
}

/** Build the href for handing the user's unmatched query off to Auteur. */
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
    const [searchEntered, setSearchEntered] = useState(false);
    const [listEntered, setListEntered] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // Auto-focus search input + close on Escape.
    useEffect(() => {
        if (!open) return;
        requestAnimationFrame(() => searchRef.current?.focus());
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    // Reset transient UI state when the launchpad closes. The component
    // stays mounted across open toggles, so without this the stagger
    // animation would only run on first open and the search query would
    // persist from a previous session.
    useEffect(() => {
        if (!open) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on close so reopen re-animates with a clean slate
            setSearchEntered(false);
            // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on close so reopen re-animates with a clean slate
            setListEntered(false);
            // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on close so reopen starts from an empty query
            setSearch("");
            return;
        }
        const raf = requestAnimationFrame(() => setSearchEntered(true));
        const timer = setTimeout(() => setListEntered(true), 99);
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(timer);
        };
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

    // When the query doesn't match any destination, offer to hand it to
    // Auteur instead of showing a dead-end empty state.
    const auteurItem = LAUNCHPAD_ITEMS.find((item) => item.id === "auteur");
    const showAskAuteur =
        filtered.length === 0 && trimmedQuery.length > 0 && auteurItem !== undefined;

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-xl"
                onClick={onClose}
                aria-hidden
            />

            {/* Positioning wrapper — centers the two-card stack */}
            <div className="fixed left-1/2 top-1/2 z-[81] w-[calc(100%-32px)] max-w-[580px] -translate-x-1/2 -translate-y-1/2 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:bottom-0 max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:px-3 max-sm:pb-[calc(env(safe-area-inset-bottom,16px)+8px)]">
                <div className="flex flex-col gap-2.5">
                    {/* Search card */}
                    <div
                        className={`overflow-hidden ${CARD_SURFACE_CLASSES} transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                            searchEntered
                                ? "translate-y-0 opacity-100"
                                : "translate-y-2 opacity-0"
                        }`}
                    >
                        <div className="flex items-center gap-3.5 px-5 py-4 max-sm:px-4">
                            <svg
                                className="shrink-0 text-[#52525b]"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
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
                                className="flex-1 bg-transparent text-[17px] font-medium text-white placeholder-[#52525b] outline-none max-sm:text-[16px]"
                                autoComplete="off"
                            />
                            <span className="hidden select-none rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[#52525b] sm:block">
                                ESC
                            </span>
                        </div>
                    </div>

                    {/* List card */}
                    <div
                        className={`overflow-hidden ${CARD_SURFACE_CLASSES} transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                            listEntered
                                ? "translate-y-0 opacity-100"
                                : "translate-y-1.5 opacity-0"
                        }`}
                    >
                        {/* Grid overlay: the invisible baseline sets a stable
                            height from the full item registry so the card
                            doesn't jump as the user narrows the filter. The
                            real list stacks in the same grid cell on top. */}
                        <div className="grid max-h-[60vh] overflow-y-auto max-sm:max-h-[55svh]">
                            <ul
                                aria-hidden
                                className="invisible col-start-1 row-start-1 p-2.5 max-sm:p-2"
                            >
                                {LAUNCHPAD_ITEMS.map((item) => (
                                    <li key={item.id}>
                                        <div className={ROW_LAYOUT_CLASSES}>
                                            <LaunchpadRowContent item={item} />
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <ul className="col-start-1 row-start-1 p-2.5 max-sm:p-2">
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
                                    <li className="py-7 text-center text-[14px] text-[#52525b]">
                                        No results found
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

// ─── Keyboard shortcut hook ─────────────────────────────────────────────────

/**
 * Opens the Launchpad on Cmd+K (Mac) or Ctrl+K (Windows/Linux).
 * Returns [open, setOpen] for the parent to wire into the Launchpad.
 */
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
