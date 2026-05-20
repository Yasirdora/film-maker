"use client";

/**
 * Launchpad — Spotlight-style command palette.
 *
 * Triggered by the "Get Started" nav button or ⌘K / Ctrl+K. Built on
 * Radix Dialog primitives for focus trapping + a11y. When no search
 * result matches, we offer to hand the query to Artistic Intelligence instead of a
 * dead-end empty state.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";

import { ArtisticIntelligenceIcon } from "./icons/artistic-intelligence-icon";

// ─── Destination registry ───────────────────────────────────────────────────
//
// Items are grouped into sections so the panel scans top-down at a glance
// instead of reading as a flat list. The first section has no `title` and
// hosts Artistic Intelligence alone — it's the brand's primary AI affordance and earns
// its own breathing room above the labelled groups.
//
// Search collapses the structure: typing anything flattens the visible
// list and hides headers (we still match against title + subtitle on the
// full registry).

interface LaunchpadItem {
    id: string;
    title: string;
    /** Optional dim hint after the title. Omit for items whose label
     *  is self-explanatory. */
    subtitle?: string;
    href: string;
    actionLabel: string;
    icon: React.ReactNode;
    /**
     * Small rightmost pill — used for "Coming soon" / "Beta" / "New"
     * labels. When `disabled` is true the badge takes the place the
     * hover action label would otherwise occupy.
     */
    badge?: string;
    /**
     * When true the row is rendered as a non-interactive
     * `<button disabled>` (dimmed, no hover, no click). Used for
     * destinations not yet shipped so users see what's coming
     * without hitting a 404.
     */
    disabled?: boolean;
}

interface LaunchpadSection {
    id: string;
    /** Omitted = unheadered section (used for the hero row). */
    title?: string;
    items: LaunchpadItem[];
}

const LAUNCHPAD_SECTIONS: LaunchpadSection[] = [
    {
        id: "hero",
        items: [
            {
                id: "artistic-intelligence",
                title: "Artistic Intelligence",
                subtitle: "AI creative assistant",
                href: "/artistic-intelligence",
                actionLabel: "Ask",
                icon: <ArtisticIntelligenceIcon size={20} strokeWidth={1.75} />,
            },
        ],
    },
    {
        id: "ai",
        title: "Artistic Intelligence",
        items: [
            {
                id: "studio",
                title: "Studio",
                subtitle: "Your projects and generations",
                href: "/studio",
                actionLabel: "Open",
                /* Clapperboard brand mark — same paths as the landing hero
                   loader and StudioMockup. The paths run almost edge-to-edge
                   of their native 31×29 box, so the viewBox is expanded to
                   "-2 -2 35 33" to give the stroke (half-width 1.375 at
                   strokeWidth 2.75) room to breathe without clipping;
                   render size is bumped from 20 to 22 to keep on-screen
                   footprint matched to the other icons. */
                icon: (
                    <svg width="22" height="22" viewBox="-2 -2 35 33" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
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
                badge: "Coming soon",
                disabled: true,
                /* 2×2 grid of rounded squares — the apps-launcher waffle. */
                icon: (
                    <svg width="20" height="20" viewBox="2 2 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" rx="1.5" />
                        <rect x="14" y="3" width="7" height="7" rx="1.5" />
                        <rect x="3" y="14" width="7" height="7" rx="1.5" />
                        <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    </svg>
                ),
            },
        ],
    },
    {
        id: "media",
        title: "Media Hub",
        items: [
            {
                id: "video-editor",
                title: "Video Editor",
                subtitle: "Compose, trim, export",
                href: "/editor/video",
                actionLabel: "Open",
                /* Video camera with side projector — Lucide `video`. */
                icon: (
                    <svg width="20" height="20" viewBox="1 5 22 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="6" width="14" height="12" rx="2" />
                        <path d="m22 8-6 4 6 4V8Z" />
                    </svg>
                ),
            },
            {
                id: "photo-editor",
                title: "Photo Editor",
                subtitle: "Open, adjust, export images",
                href: "/editor/photo",
                actionLabel: "Open",
                /* Lucide `image` — landscape with a sun, the universal
                   "photo" affordance across editing tools. */
                icon: (
                    <svg width="20" height="20" viewBox="2 2 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-5-5L5 21" />
                    </svg>
                ),
            },
            {
                id: "audio-editor",
                title: "Audio Editor",
                subtitle: "Multi-track audio + record",
                href: "/editor/audio",
                actionLabel: "Open",
                /* Audio waveform pulse — Lucide-style `audio-waveform`. */
                icon: (
                    <svg width="20" height="20" viewBox="1 5 22 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12h2l2-6 4 12 3-9 3 6h4" />
                    </svg>
                ),
            },
            {
                id: "media-converter",
                title: "Media Converter",
                subtitle: "Convert between formats",
                href: "/editor/converter",
                actionLabel: "Open",
                /* Opposite-direction arrows — Lucide `arrow-right-left`. */
                icon: (
                    <svg width="20" height="20" viewBox="2 2 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 11 21 7 17 3" />
                        <line x1="21" y1="7" x2="9" y2="7" />
                        <polyline points="7 13 3 17 7 21" />
                        <line x1="15" y1="17" x2="3" y2="17" />
                    </svg>
                ),
            },
        ],
    },
    {
        id: "learn",
        title: "Learn",
        items: [
            {
                id: "academy",
                title: "Film-maker Academy",
                subtitle: "How-to and tutorials",
                /* Placeholder href — the row is rendered disabled so
                   the click is a no-op. Swap to the real path when the
                   academy ships and flip `disabled` to false. */
                href: "/academy",
                actionLabel: "Open",
                badge: "Coming soon",
                disabled: true,
                /* Lucide graduation cap. */
                icon: (
                    <svg width="20" height="20" viewBox="1 4 22 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 10v6" />
                        <path d="M2 10l10-5 10 5-10 5-10-5z" />
                        <path d="M6 12v5c3 3 9 3 12 0v-5" />
                    </svg>
                ),
            },
        ],
    },
    {
        id: "account",
        title: "Account",
        items: [
            {
                id: "pricing",
                title: "Plan",
                href: "/pricing",
                actionLabel: "Open",
                /* Credit card — universal billing affordance. */
                icon: (
                    <svg width="20" height="20" viewBox="1 4 22 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                ),
            },
        ],
    },
];

/** Flat view of every item for search filtering + ID lookups. */
const LAUNCHPAD_ITEMS: LaunchpadItem[] = LAUNCHPAD_SECTIONS.flatMap(
    (section) => section.items,
);

// Row layout shared between the interactive list and the invisible
// baseline phantom. Extracted so their heights stay in lockstep, which
// prevents the card from shrinking as the user narrows the filter.
const ROW_LAYOUT_CLASSES =
    "group flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2";
const ROW_INTERACTIVE_CLASSES = `${ROW_LAYOUT_CLASSES} transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline-none active:scale-[0.98]`;
/* Disabled rows: dimmed, no hover surface, no press animation. The
   `<button>` element still owns the row so screen readers announce
   the dimmed state correctly via the `disabled` attribute. */
const ROW_DISABLED_CLASSES = `${ROW_LAYOUT_CLASSES} cursor-not-allowed opacity-55`;

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
            {/* Right-edge metadata. A `badge` (e.g. "Coming soon") wins
                over the hover action label so disabled / pre-release
                rows surface their state without depending on hover. */}
            {item.badge ? (
                <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/55">
                    {item.badge}
                </span>
            ) : (
                <span
                    className={`shrink-0 text-[12px] font-semibold text-[#a1a1aa] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${
                        actionLabelAlwaysVisible ? "opacity-100" : "opacity-0"
                    }`}
                >
                    {actionLabel}
                </span>
            )}
        </>
    );
}

function buildArtisticIntelligenceQueryHref(query: string): string {
    return `/artistic-intelligence?q=${encodeURIComponent(query)}`;
}

// ─── Result list ────────────────────────────────────────────────────────────
//
// Pure presentation, takes its query from a parent. Lives as its own
// component so the dialog body can compose a search input + this list
// without duplicating the filtering / "ask Artistic Intelligence" fallback logic.

interface LaunchpadListProps {
    search: string;
    onNavigate: (href: string) => void;
}

/**
 * Renders the destination list. Two modes, switched by query state:
 *
 *   • Idle (empty query) — shows every section with its header label,
 *     and items in their declared order. This is the "discovery" view.
 *   • Search (non-empty query) — flattens to a single result list,
 *     hiding the section headers. Headers would be noise when the user
 *     is already narrowing by keyword; the flat list reads as a
 *     classic command-palette result set.
 *
 * Either mode shares the same row markup, so visual rhythm doesn't
 * change between the two states. The invisible baseline phantom
 * reserves the height of the fully-expanded sectioned tree, so
 * narrowing the filter doesn't shrink the panel.
 */
function LaunchpadList({ search, onNavigate }: LaunchpadListProps) {
    const trimmedQuery = search.trim();
    const isSearching = trimmedQuery.length > 0;

    const filtered = LAUNCHPAD_ITEMS.filter((item) => {
        const q = search.toLowerCase();
        return (
            item.title.toLowerCase().includes(q) ||
            (item.subtitle?.toLowerCase().includes(q) ?? false)
        );
    });

    const artisticIntelligenceItem = LAUNCHPAD_ITEMS.find((item) => item.id === "artistic-intelligence");
    const showAskArtisticIntelligence =
        filtered.length === 0 && isSearching && artisticIntelligenceItem !== undefined;

    return (
        // Grid overlay: invisible baseline sets a stable height from the
        // full sectioned tree so the panel doesn't jump as the filter
        // narrows. The baseline always renders the idle (sectioned)
        // layout because that's the tallest state — flat search results
        // will always fit inside it.
        //
        // The viewport is capped at 380px on desktop so the Launchpad
        // doesn't keep growing as items are added — it scrolls
        // internally instead. Mobile keeps the 55svh sheet height to
        // play well with the bottom-sheet form factor.
        <div className="grid max-h-[380px] overflow-y-auto p-2 max-sm:max-h-[55svh]">
            <ul aria-hidden className="invisible col-start-1 row-start-1">
                {LAUNCHPAD_SECTIONS.map((section) => (
                    <li key={section.id}>
                        {section.title && <SectionHeader title={section.title} />}
                        <ul>
                            {section.items.map((item) => (
                                <li key={item.id}>
                                    <div className={ROW_LAYOUT_CLASSES}>
                                        <LaunchpadRowContent item={item} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
            </ul>

            <ul className="col-start-1 row-start-1">
                {isSearching ? (
                    filtered.length > 0 ? (
                        /* Flat result list — no section headers when the
                           user is narrowing by keyword. */
                        filtered.map((item) => (
                            <li key={item.id}>
                                <ItemButton item={item} onNavigate={onNavigate} />
                            </li>
                        ))
                    ) : showAskArtisticIntelligence && artisticIntelligenceItem ? (
                        <li>
                            <button
                                type="button"
                                onClick={() =>
                                    onNavigate(buildArtisticIntelligenceQueryHref(trimmedQuery))
                                }
                                className={ROW_INTERACTIVE_CLASSES}
                            >
                                <LaunchpadRowContent
                                    item={artisticIntelligenceItem}
                                    titleOverride={`“${trimmedQuery}”`}
                                    actionLabelOverride="Ask Artistic Intelligence AI"
                                    actionLabelAlwaysVisible
                                />
                            </button>
                        </li>
                    ) : (
                        <li className="py-7 text-center text-[14px] text-[#a1a1aa]">
                            No results found
                        </li>
                    )
                ) : (
                    /* Idle — render sections with headers, items in
                       declared order. Section roles wrap each group so
                       a screen-reader announces the labelled
                       categories. */
                    LAUNCHPAD_SECTIONS.map((section) => (
                        <li key={section.id} role="group" aria-labelledby={section.title ? `lp-section-${section.id}` : undefined}>
                            {section.title && (
                                <SectionHeader
                                    title={section.title}
                                    id={`lp-section-${section.id}`}
                                />
                            )}
                            <ul>
                                {section.items.map((item) => (
                                    <li key={item.id}>
                                        <ItemButton
                                            item={item}
                                            onNavigate={onNavigate}
                                        />
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))
                )}
            </ul>
        </div>
    );
}

/**
 * Single launchpad row. Renders as `<button>` whose semantics adapt to
 * the item's `disabled` flag — a disabled item still appears (so the
 * user can see "Coming soon" rows) but is non-interactive and
 * dimmed. Using the native `disabled` attribute lets screen readers
 * announce the dimmed state correctly.
 */
function ItemButton({
    item,
    onNavigate,
}: {
    item: LaunchpadItem;
    onNavigate: (href: string) => void;
}) {
    return (
        <button
            type="button"
            disabled={item.disabled}
            aria-disabled={item.disabled || undefined}
            onClick={() => {
                if (item.disabled) return;
                onNavigate(item.href);
            }}
            className={item.disabled ? ROW_DISABLED_CLASSES : ROW_INTERACTIVE_CLASSES}
        >
            <LaunchpadRowContent item={item} />
        </button>
    );
}

/**
 * Section header. Mimics the conventions used by Raycast / macOS
 * Spotlight: tiny uppercase tracking-wide label in a muted tone,
 * separated from the items below by minimal padding so the header
 * reads as a divider, not a row.
 */
function SectionHeader({ title, id }: { title: string; id?: string }) {
    return (
        <div
            id={id}
            className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35"
        >
            {title}
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
                <DialogPrimitive.Overlay className="launchpad-overlay fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm" />
                <DialogPrimitive.Content
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    className="launchpad-content fixed left-1/2 top-1/2 z-[201] w-[calc(100%-32px)] max-w-[580px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[20px] border border-white/[0.08] bg-[rgba(22,22,24,0.85)] shadow-[0_24px_48px_rgba(0,0,0,0.25),0_48px_80px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] outline-none backdrop-blur-[40px] backdrop-saturate-150 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:bottom-0 max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom,0px)]"
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

