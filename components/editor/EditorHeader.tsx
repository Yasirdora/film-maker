"use client";

/**
 * EditorHeader — universal top bar for `/editor/*` routes.
 *
 *   • Static clapperboard brand mark on the left.
 *   • Click-toggle nav dropdowns (Artistic Intelligence, Video, Image,
 *     Audio, Media Converter) with category descriptions.
 *   • `rightSlot` — auth-aware cluster injected by the server layout
 *     (sign-in / get-started / profile, see EditorHeaderAuthSlot).
 *
 * Page-specific breadcrumbs and toolbars are NOT this component's concern
 * — each page renders a `<PageBar>` underneath with its own trail and
 * actions.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { ClapperboardIcon } from "@/components/icons/clapperboard-icon";

// ─── Nav data ───────────────────────────────────────────────────────────────

interface NavItem {
    label: string;
    href?: string;
    description?: string;
    badge?: "soon" | "new";
}

interface NavSection {
    label: string;
    items: NavItem[];
    href?: string;
}

const NAV: NavSection[] = [
    {
        label: "Artistic Intelligence",
        href: "/artistic-intelligence",
        items: [
            {
                label: "AI Assistant",
                href: "/artistic-intelligence",
                description: "Chat with the AI filmmaker.",
            },
            {
                label: "Script",
                description: "Draft scenes, beats, and dialogue.",
                badge: "soon",
            },
            {
                label: "Storyboard",
                description: "Sketch shots and sequence them.",
                badge: "soon",
            },
        ],
    },
    { label: "Studio", href: "/studio", items: [] },
    {
        /* Hover-open dropdown of the currently-available editor tools.
           Clicking the label itself still navigates to /editor (the
           landing grid of every tool, live and coming-soon); the
           dropdown surfaces the four shipped editors so users can
           jump straight in without the extra hop. Add new tools here
           as they ship; leave coming-soon ones in the /editor landing
           tiles where the "soon" status reads clearly. */
        label: "Tools",
        href: "/editor",
        items: [
            {
                label: "Video Editor",
                href: "/editor/video",
                description: "Compose, trim, export.",
            },
            {
                label: "Photo Editor",
                href: "/editor/photo",
                description: "Open, adjust, export images.",
            },
            {
                label: "Audio Editor",
                href: "/editor/audio",
                description: "Multi-track audio + record.",
            },
            {
                label: "Media Converter",
                href: "/editor/converter",
                description: "Convert between formats.",
            },
        ],
    },
    { label: "Plan", href: "/pricing", items: [] },
];

// ─── Header ─────────────────────────────────────────────────────────────────

interface EditorHeaderProps {
    /** Where the brand mark links to. Defaults to `/`. */
    brandHref?: string;
    /**
     * Optional inline content rendered between the brand and the right
     * slot (e.g. centered status, page-specific actions).
     */
    children?: ReactNode;
    /**
     * Right cluster. Provided by the server layout so it can carry
     * auth-aware UI (sign-in / get-started for anonymous visitors,
     * profile menu for signed-in users).
     */
    rightSlot: ReactNode;
}

export function EditorHeader({
    brandHref = "/",
    children,
    rightSlot,
}: EditorHeaderProps) {
    const [openSection, setOpenSection] = useState<string | null>(null);
    const navRootRef = useRef<HTMLDivElement>(null);

    const pathname = usePathname();

    // Close the open menu on outside click or Escape.
    useEffect(() => {
        if (openSection === null) return;
        function onDoc(e: MouseEvent) {
            const target = e.target as Node;
            const insideNav = navRootRef.current?.contains(target) ?? false;
            if (!insideNav) setOpenSection(null);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpenSection(null);
        }
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey);
        };
    }, [openSection]);

    // Auto-close any open menu when the route changes. Synchronizing with
    // the external `pathname` is exactly the kind of cross-system effect
    // the rule allows for; the unconditional `setState` looks suspicious
    // to the linter but cannot loop (pathname only ticks on navigation).
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOpenSection(null);
    }, [pathname]);

    return (
        <header
            id="app-nav-root"
            /* z-[60] so dropdowns clear sibling chrome that also sits at
               z-50 with its own stacking context (e.g. the artistic-intelligence sidebar
               which uses backdrop-filter). Still well below modals
               (launchpad z-200, in-sidebar popovers z-1000). */
            className="sticky top-0 z-[60] w-full border-b border-white/[0.04] bg-ws-canvas"
        >
            {/* Inner row height pinned to --header-height so the landing
                page's StickyNav can tuck under it cleanly and translate
                up by exactly that amount when the bar auto-hides. The
                value lives in globals.css (56px <850, 64px ≥850). */}
            <div className="flex h-[var(--header-height)] items-center gap-2 sm:gap-3 px-4 sm:px-8">
                <Link
                    href={brandHref}
                    aria-label="Film-maker — home"
                    className="inline-flex items-center shrink-0"
                >
                    <ClapperboardIcon
                        className="h-auto overflow-visible text-white opacity-80 w-8 sm:w-9"
                    />
                </Link>

                {/* Primary nav — hidden on small viewports to keep the bar tight */}
                <nav
                    ref={navRootRef}
                    className="hidden lg:flex items-stretch gap-1 min-w-0"
                >
                    {NAV.map((section) => (
                        <NavMenu
                            key={section.label}
                            section={section}
                            isOpen={openSection === section.label}
                            onSetOpen={(open) =>
                                setOpenSection(open ? section.label : null)
                            }
                            onItemNavigate={() => setOpenSection(null)}
                        />
                    ))}
                </nav>

                {children && (
                    <div className="flex items-center justify-center min-w-0 flex-1">
                        {children}
                    </div>
                )}

                <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
                    {rightSlot}
                </div>
            </div>
        </header>
    );
}

// ─── Nav menu ───────────────────────────────────────────────────────────────

function NavMenu({
    section,
    isOpen,
    onSetOpen,
    onItemNavigate,
}: {
    section: NavSection;
    isOpen: boolean;
    onSetOpen: (open: boolean) => void;
    onItemNavigate: () => void;
}) {
    // The "Artistic Intelligence" section anchors the brand experience —
    // always-underlined as a visual cue. Other sections show an indicator
    // only when their dropdown is open.
    const isPrimary = section.label === "Artistic Intelligence" || section.label === "Studio";
    const hasDropdown = section.items.length > 0;

    /* Hover-open dropdowns suffer from an 8px gap between the label and
       the menu — crossing it fires mouseleave on the parent before the
       mouse reaches the dropdown, which would close the menu underfoot.
       A short close delay (cancelled if the cursor re-enters either the
       label or the dropdown) is the standard fix. */
    const closeTimer = useRef<number | null>(null);
    const cancelClose = useCallback(() => {
        if (closeTimer.current !== null) {
            window.clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
    }, []);
    const scheduleClose = useCallback(() => {
        cancelClose();
        closeTimer.current = window.setTimeout(() => onSetOpen(false), 140);
    }, [cancelClose, onSetOpen]);
    useEffect(() => () => cancelClose(), [cancelClose]);

    // Plain link, no dropdown.
    if (section.href && !hasDropdown) {
        return (
            <Link
                href={section.href}
                onClick={onItemNavigate}
                className={`relative inline-flex items-center gap-1 px-3 py-2 text-[14px] transition-colors ${
                    isPrimary ? "font-semibold text-white" : "font-medium text-[#8e8e93] hover:text-white"
                }`}
            >
                {section.label}
            </Link>
        );
    }

    // Either a click-toggle dropdown (no href) or a hover-to-open dropdown
    // whose label itself is a navigating link (href + items).
    const labelClasses = `relative inline-flex items-center gap-1 px-3 py-2 text-[14px] font-medium transition-colors ${
        isPrimary ? "text-white" : "text-[#8e8e93] hover:text-white"
    }`;

    const chevron = !isPrimary && (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-3 h-3 transition-transform ${
                isOpen ? "rotate-180" : ""
            }`}
        >
            <polyline points="6 9 12 15 18 9" />
        </svg>
    );

    const underline = isPrimary && (
        <span
            aria-hidden
            className="absolute left-3 right-3 -bottom-[1px] h-[2px] bg-white"
        />
    );

    return (
        <div
            className="relative"
            onMouseEnter={section.href ? () => { cancelClose(); onSetOpen(true); } : undefined}
            onMouseLeave={section.href ? scheduleClose : undefined}
        >
            {section.href ? (
                <Link
                    href={section.href}
                    onClick={() => { cancelClose(); onItemNavigate(); }}
                    onFocus={() => { cancelClose(); onSetOpen(true); }}
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    className={labelClasses}
                >
                    {section.label}
                    {chevron}
                    {underline}
                </Link>
            ) : (
                <button
                    type="button"
                    onClick={() => onSetOpen(!isOpen)}
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    className={labelClasses}
                >
                    {section.label}
                    {chevron}
                    {underline}
                </button>
            )}

            {isOpen && (
                /* Outer wrapper carries the transparent 8px hover bridge
                   so the cursor can travel from label → menu without
                   tripping the close-on-leave. The inner `.ui-menu`
                   paints the actual surface and matches every other
                   menu across the product. */
                <div
                    className="absolute left-0 top-full pt-2 z-30"
                    onMouseEnter={section.href ? cancelClose : undefined}
                    onMouseLeave={section.href ? scheduleClose : undefined}
                >
                    <div role="menu" className="ui-menu" style={{ minWidth: 260 }}>
                        {section.items.map((item, i) => (
                            <NavDropdownItem
                                key={`${item.label}-${i}`}
                                item={item}
                                onNavigate={onItemNavigate}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function NavDropdownItem({
    item,
    onNavigate,
}: {
    item: NavItem;
    onNavigate: () => void;
}) {
    /* Two-line variant of `.ui-menu-item` (label + description). The
       hover background matches the canonical menu hover so this row
       reads the same as a single-line menu item visually. */
    const inner = (
        <div className="px-3 py-2.5 rounded-lg transition-colors hover:bg-white/[0.08]">
            <div className="flex items-center gap-2">
                <span
                    className={`text-[14px] font-medium ${
                        item.href ? "text-white" : "text-[#8e8e93]"
                    }`}
                >
                    {item.label}
                </span>
                {item.badge && <Badge kind={item.badge} />}
            </div>
            {item.description && (
                <p className="mt-0.5 text-[12px] text-[#8e8e93] leading-snug">
                    {item.description}
                </p>
            )}
        </div>
    );
    if (item.href) {
        return (
            <Link
                href={item.href}
                role="menuitem"
                onClick={onNavigate}
                className="block"
            >
                {inner}
            </Link>
        );
    }
    return (
        <div
            role="menuitem"
            aria-disabled
            className="block cursor-default opacity-70"
        >
            {inner}
        </div>
    );
}

function Badge({ kind }: { kind: "soon" | "new" }) {
    const palette =
        kind === "soon"
            ? { bg: "#1c1c1f", text: "#8e8e93", border: "#26262a" }
            : { bg: "#1c1c1f", text: "#5eead4", border: "#264a44" };
    return (
        <span
            className="inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase"
            style={{
                backgroundColor: palette.bg,
                color: palette.text,
                borderColor: palette.border,
            }}
        >
            {kind === "soon" ? "Soon" : "New"}
        </span>
    );
}
