/**
 * Editor toolbar — right-edge rail introducing the product surface.
 *
 * Replaces the earlier purely-decorative rail of art-directed icons.
 * Each slot now points to a real destination in the product (Auteur,
 * Studio, Video / Audio editors, Media Converter) or to a coming-soon
 * tool (Apps, Film-maker Academy) so visitors can see at a glance what
 * the app contains and click straight through. Icon set mirrors the
 * Launchpad's so brand language carries one-to-one.
 *
 * Hidden on narrow viewports (rail stops adding signal once the hero
 * stacks). Coming-soon entries render as a dimmed, non-interactive
 * marker with a tiny status dot in the top-right corner of the icon
 * tile and a "Coming soon" title attribute for tooltip discovery.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import clsx from "clsx";

import { AuteurIcon } from "@/components/icons/auteur-icon";
import styles from "./editor-toolbar.module.css";

interface ToolbarItem {
    key: string;
    /** Human label — used for the tooltip + a11y label. */
    label: string;
    /** Visual content rendered inside the slot. */
    icon: ReactNode;
    /** Destination route. Omit when `comingSoon` is true. */
    href?: string;
    /** Renders the slot dimmed + non-interactive with a status dot. */
    comingSoon?: boolean;
}

/* Clapperboard brand mark — same paths as the launchpad's Studio row,
   StudioMockup, and the boot loader, so the rail's brand cue reads
   identically wherever it appears. */
const studioIcon: ReactNode = (
    <svg viewBox="-2 -2 35 33" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M29.909 12.6187H1.40347C1.07709 12.6187 0.8125 12.8827 0.8125 13.2083V27.4104C0.8125 27.7361 1.07709 28 1.40347 28H29.909C30.2354 28 30.5 27.7361 30.5 27.4104V13.2083C30.5 12.8827 30.2354 12.6187 29.909 12.6187Z" />
        <path transform="translate(0 -0.8)" d="M1.98245 12.142L29.3924 8.1487C29.9012 8.07358 30.2481 7.60548 30.1787 7.09692L29.3346 1.2948C29.2594 0.786245 28.7911 0.439504 28.2824 0.508852L1.29445 4.44436C0.814588 4.51371 0.4677 4.94135 0.502389 5.42679L0.924436 11.2925C0.964907 11.8299 1.45055 12.2229 1.98245 12.142Z" />
    </svg>
);

const TOOLBAR_ITEMS: ToolbarItem[] = [
    {
        key: "auteur",
        label: "Auteur — AI creative assistant",
        href: "/auteur",
        icon: <AuteurIcon size={18} strokeWidth={1.75} />,
    },
    {
        key: "studio",
        label: "Studio — projects and generations",
        href: "/studio",
        icon: studioIcon,
    },
    {
        key: "apps",
        label: "Apps — coming soon",
        comingSoon: true,
        /* 2×2 grid — apps-launcher waffle. */
        icon: (
            <svg width="18" height="18" viewBox="2 2 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
        ),
    },
    {
        key: "video",
        label: "Video Editor — compose, trim, export",
        href: "/editor/video",
        icon: (
            <svg width="20" height="20" viewBox="1 5 22 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="2" y="6" width="14" height="12" rx="2" />
                <path d="m22 8-6 4 6 4V8Z" />
            </svg>
        ),
    },
    {
        key: "photo",
        label: "Photo Editor — open, adjust, export images",
        href: "/editor/photo",
        icon: (
            <svg width="18" height="18" viewBox="2 2 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-5-5L5 21" />
            </svg>
        ),
    },
    {
        key: "audio",
        label: "Audio Editor — multi-track audio + record",
        href: "/editor/audio",
        icon: (
            <svg width="20" height="20" viewBox="1 5 22 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2 12h2l2-6 4 12 3-9 3 6h4" />
            </svg>
        ),
    },
    {
        key: "converter",
        label: "Media Converter — convert between formats",
        href: "/editor/converter",
        icon: (
            <svg width="18" height="18" viewBox="2 2 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="17 11 21 7 17 3" />
                <line x1="21" y1="7" x2="9" y2="7" />
                <polyline points="7 13 3 17 7 21" />
                <line x1="15" y1="17" x2="3" y2="17" />
            </svg>
        ),
    },
    {
        key: "academy",
        label: "Film-maker Academy — coming soon",
        comingSoon: true,
        icon: (
            <svg width="20" height="20" viewBox="1 4 22 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M22 10v6" />
                <path d="M2 10l10-5 10 5-10 5-10-5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
        ),
    },
];

export function EditorToolbar() {
    return (
        <aside className={styles.editorToolbar} aria-label="Product tools">
            {TOOLBAR_ITEMS.map((item) => {
                if (item.comingSoon) {
                    return (
                        <span
                            key={item.key}
                            className={clsx(styles.toolIcon, styles.toolIconSoon)}
                            title={item.label}
                            aria-label={item.label}
                            aria-disabled="true"
                        >
                            {item.icon}
                            <span aria-hidden className={styles.toolDot} />
                        </span>
                    );
                }
                return (
                    <Link
                        key={item.key}
                        href={item.href!}
                        className={styles.toolIcon}
                        title={item.label}
                        aria-label={item.label}
                    >
                        {item.icon}
                    </Link>
                );
            })}
        </aside>
    );
}
