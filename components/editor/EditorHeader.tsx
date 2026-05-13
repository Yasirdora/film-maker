"use client";

/**
 * EditorHeader — universal top bar for `/editor/*` routes.
 *
 *   • Animated clapperboard brand mark on the left.
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
import {
    ClapperboardIcon,
    type ClapperboardIconHandle,
} from "@/components/icons/clapperboard-icon";

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
        items: [
            {
                label: "AI Studio",
                href: "/studio",
                description: "Generate, refine, and direct.",
            },
            {
                label: "Auteur",
                href: "/auteur",
                description: "Chat with the AI filmmaker.",
            },
        ],
    },
    {
        label: "Studio",
        items: [
            {
                label: "Photo",
                href: "/studio",
                description: "Generate images with Nano Banana Pro.",
            },
            {
                label: "Video",
                description: "Generate clips and cinematic shots.",
                badge: "soon",
            },
            {
                label: "Audio",
                description: "Music, voice, and sound effects.",
                badge: "soon",
            },
        ],
    },
    {
        label: "Tools",
        href: "/editor",
        items: [],
    },
    {
        label: "Plan",
        href: "/pricing",
        items: [],
    },
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
    const clapRef = useRef<ClapperboardIconHandle>(null);
    const replayClap = useCallback(() => clapRef.current?.clap(), []);
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
            className="sticky top-0 z-50 w-full border-b border-white/[0.04] bg-ws-canvas"
        >
            {/* Inner row height pinned to --header-height so the landing
                page's StickyNav can tuck under it cleanly and translate
                up by exactly that amount when the bar auto-hides. The
                value lives in globals.css (56px <850, 64px ≥850). */}
            <div className="flex h-[var(--header-height)] items-center gap-2 sm:gap-3 px-4 sm:px-8">
                <Link
                    href={brandHref}
                    aria-label="Film-maker — home"
                    onMouseEnter={replayClap}
                    onFocus={replayClap}
                    className="group inline-flex items-center shrink-0"
                >
                    <ClapperboardIcon
                        ref={clapRef}
                        autoClap
                        className="h-auto overflow-visible text-white opacity-80 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:scale-110 group-hover:opacity-100 w-8 sm:w-9"
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
                            onToggle={() =>
                                setOpenSection((cur) =>
                                    cur === section.label ? null : section.label,
                                )
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
    onToggle,
    onItemNavigate,
}: {
    section: NavSection;
    isOpen: boolean;
    onToggle: () => void;
    onItemNavigate: () => void;
}) {
    // The "Artistic Intelligence" section anchors the brand experience —
    // always-underlined as a visual cue. Other sections show an indicator
    // only when their dropdown is open.
    const isPrimary = section.label === "Artistic Intelligence";

    if (section.href) {
        return (
            <Link
                href={section.href}
                onClick={onItemNavigate}
                className="relative inline-flex items-center gap-1 px-3 py-2 text-[14px] font-medium text-[#8e8e93] hover:text-white transition-colors"
            >
                {section.label}
            </Link>
        );
    }

    return (
        <div className="relative">
            <button
                type="button"
                onClick={onToggle}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                className={`relative inline-flex items-center gap-1 px-3 py-2 text-[14px] font-medium transition-colors ${
                    isPrimary ? "text-white" : "text-[#8e8e93] hover:text-white"
                }`}
            >
                {section.label}
                {!isPrimary && (
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
                )}
                {isPrimary && (
                    <span
                        aria-hidden
                        className="absolute left-3 right-3 -bottom-[1px] h-[2px] bg-white"
                    />
                )}
            </button>

            {isOpen && (
                <div
                    role="menu"
                    className="absolute left-0 top-full mt-2 min-w-[260px] rounded-xl py-1.5 z-30 shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
                    style={{
                        backgroundColor: "#121214",
                        border: "1px solid #1f1f22",
                    }}
                >
                    {section.items.map((item, i) => (
                        <NavDropdownItem
                            key={`${item.label}-${i}`}
                            item={item}
                            onNavigate={onItemNavigate}
                        />
                    ))}
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
    const inner = (
        <div className="px-3 py-2.5 rounded-md transition-colors hover:bg-white/[0.04]">
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
                className="block px-1"
            >
                {inner}
            </Link>
        );
    }
    return (
        <div
            role="menuitem"
            aria-disabled
            className="block px-1 cursor-default opacity-70"
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
