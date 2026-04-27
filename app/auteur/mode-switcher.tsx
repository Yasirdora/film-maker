/**
 * Mode switcher — vertical nav rail rendered inside the sidebar.
 *
 * Three rows: Chat, Script, Storyboard. Locked rows render with a
 * small lock glyph and call `onLockedClick` (typically to surface a
 * toast / upgrade CTA). Active row shows a tinted background pill.
 */

"use client";

import * as React from "react";
import type { AuteurMode } from "@/lib/auteur";
import styles from "./auteur.module.css";

interface ModeEntry {
    id: AuteurMode;
    label: string;
    icon: React.ReactNode;
}

const MODES: ModeEntry[] = [
    {
        id: "chat",
        label: "Chat",
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
        ),
    },
    {
        id: "script",
        label: "Script",
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M8 13h8" />
                <path d="M8 17h5" />
            </svg>
        ),
    },
    {
        id: "storyboard",
        label: "Storyboard",
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="m15 15-3 3-1.5-1.5" />
            </svg>
        ),
    },
];

interface ModeNavProps {
    mode: AuteurMode;
    onChange: (next: AuteurMode) => void;
    unlockedModes: ReadonlySet<AuteurMode>;
    onLockedClick?: (mode: AuteurMode) => void;
}

export function ModeNav({
    mode,
    onChange,
    unlockedModes,
    onLockedClick,
}: ModeNavProps) {
    return (
        <nav className={styles.modeNav} aria-label="Auteur mode">
            {MODES.map((m) => {
                const isActive = m.id === mode;
                const isLocked = !unlockedModes.has(m.id);
                const classes = [
                    styles.modeItem,
                    isActive ? styles.modeItemActive : "",
                    isLocked ? styles.modeItemLocked : "",
                ]
                    .filter(Boolean)
                    .join(" ");
                return (
                    <button
                        key={m.id}
                        type="button"
                        className={classes}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => {
                            if (isLocked) {
                                onLockedClick?.(m.id);
                                return;
                            }
                            if (!isActive) onChange(m.id);
                        }}
                    >
                        {m.icon}
                        <span className={`${styles.modeLabel} ${styles.sidebarLabel}`}>{m.label}</span>
                        {isLocked && (
                            <span className={styles.sidebarLabel}>
                                <svg
                                    className={styles.modeLockIcon}
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.75"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden
                                >
                                    <rect x="3" y="11" width="18" height="11" rx="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                            </span>
                        )}
                    </button>
                );
            })}
        </nav>
    );
}
