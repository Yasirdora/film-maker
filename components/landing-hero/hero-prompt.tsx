"use client";

/**
 * Prompt bar used as the hero's primary call-to-action and reused inside
 * the auteur landing tile.
 *
 * Structure note — the visible "textfield" IS the <input> element. All
 * the visual styling (border, background, shadow, height) lives on the
 * input itself, mirroring the announcement form which works correctly
 * on iOS. The mode dropdown and submit button float over the input's
 * right padding via absolute positioning — they're siblings of the
 * input, not ancestors, and not in a flex layout with it. This keeps
 * the input free of any of the filtered/transformed ancestors that
 * trigger iOS Safari's caret-outside-field bug on first tap.
 *
 * Composition:
 *
 *   <HeroPrompt>
 *     └── <ModeMenu>          (local, not exported — only used here)
 */

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useClickOutside } from "./hooks";
import { HERO_MODES, type HeroModeId } from "./modes";

import styles from "./landing-hero.module.css";

interface HeroPromptProps {
    placeholder?: string;
    /** Mode selected by default. Defaults to the first mode in HERO_MODES. */
    defaultModeId?: HeroModeId;
    /** Extra class merged onto the wrapper — lets callers override skin (background, border, shadow). */
    wrapperClassName?: string;
}

export function HeroPrompt({
    placeholder = "Ask Auteur anything about your creative vision...",
    defaultModeId = HERO_MODES[0].id,
    wrapperClassName,
}: HeroPromptProps) {
    const router = useRouter();

    const [value, setValue] = useState("");
    const [modeId, setModeId] = useState<HeroModeId>(defaultModeId);
    const [menuOpen, setMenuOpen] = useState(false);

    const menuAnchorRef = useRef<HTMLDivElement>(null);
    useClickOutside(menuAnchorRef, menuOpen, () => setMenuOpen(false));

    const handleSubmit = useCallback(() => {
        const trimmed = value.trim();
        if (!trimmed) return;
        const mode = HERO_MODES.find((m) => m.id === modeId) ?? HERO_MODES[0];
        router.push(mode.href(trimmed));
    }, [value, modeId, router]);

    const wrapperClass = wrapperClassName
        ? `${styles.searchWrapper} ${wrapperClassName}`
        : styles.searchWrapper;

    return (
        <form
            className={wrapperClass}
            onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
            }}
        >
            <input
                type="text"
                className={styles.searchInput}
                placeholder={placeholder}
                autoComplete="off"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-label="Creative prompt"
            />

            <div className={styles.searchActions}>
                <ModeMenu
                    anchorRef={menuAnchorRef}
                    activeModeId={modeId}
                    open={menuOpen}
                    onToggle={() => {
                        // Dismiss the virtual keyboard before opening the
                        // mode menu — on mobile the menu renders as a
                        // fixed bottom-sheet and would otherwise be
                        // hidden behind an open keyboard.
                        if (
                            typeof document !== "undefined" &&
                            document.activeElement instanceof HTMLElement
                        ) {
                            document.activeElement.blur();
                        }
                        setMenuOpen((v) => !v);
                    }}
                    onSelect={(id) => {
                        setModeId(id);
                        setMenuOpen(false);
                    }}
                />

                <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={!value.trim()}
                    aria-label="Submit prompt"
                >
                    <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                    </svg>
                </button>
            </div>
        </form>
    );
}

// ─── Internal: mode dropdown ───────────────────────────────────────────────

interface ModeMenuProps {
    anchorRef: React.RefObject<HTMLDivElement | null>;
    activeModeId: HeroModeId;
    open: boolean;
    onToggle: () => void;
    onSelect: (id: HeroModeId) => void;
}

function ModeMenu({
    anchorRef,
    activeModeId,
    open,
    onToggle,
    onSelect,
}: ModeMenuProps) {
    const activeMode =
        HERO_MODES.find((m) => m.id === activeModeId) ?? HERO_MODES[0];

    return (
        <div className={styles.modeWrapper} ref={anchorRef}>
            <button
                type="button"
                className={`${styles.modeButton}${
                    open ? ` ${styles.modeButtonActive}` : ""
                }`}
                onClick={onToggle}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`Mode: ${activeMode.label}`}
            >
                <span aria-hidden="true">{activeMode.icon}</span>
            </button>

            <div
                className={`${styles.modeMenu}${
                    open ? ` ${styles.modeMenuOpen}` : ""
                }`}
                role="listbox"
                aria-label="Prompt destination"
            >
                {HERO_MODES.map((mode) => {
                    const isActive = mode.id === activeModeId;
                    return (
                        <button
                            key={mode.id}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            className={`${styles.modeMenuItem}${
                                isActive ? ` ${styles.modeMenuItemActive}` : ""
                            }`}
                            onClick={() => onSelect(mode.id)}
                        >
                            <span aria-hidden="true">{mode.icon}</span>
                            <span className={styles.modeDetails}>
                                <span className={styles.modeTitle}>
                                    {mode.label}
                                </span>
                                <span className={styles.modeDesc}>
                                    {mode.description}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
