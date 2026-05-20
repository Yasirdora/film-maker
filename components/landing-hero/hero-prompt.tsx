"use client";

/**
 * Prompt bar used as the hero's primary call-to-action and reused inside
 * the artistic-intelligence landing tile.
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

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import { useClickOutside } from "./hooks";
import {
    DEFAULT_HERO_MODE,
    getHeroMode,
    HERO_MODES,
    type HeroModeId,
} from "./modes";

import styles from "./hero-prompt.module.css";

interface HeroPromptProps {
    placeholder: string;
    /** Mode selected by default. Defaults to the first mode in HERO_MODES. */
    defaultModeId?: HeroModeId;
    /** Extra class merged onto the wrapper — lets callers override skin (background, border, shadow). */
    wrapperClassName?: string;
}

export function HeroPrompt({
    placeholder,
    defaultModeId = DEFAULT_HERO_MODE.id,
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
        router.push(getHeroMode(modeId).href(trimmed));
    }, [value, modeId, router]);

    return (
        <form
            className={clsx(styles.searchWrapper, wrapperClassName)}
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

/**
 * Accessible mode picker for the hero prompt bar.
 *
 * Follows the WAI-ARIA Menu Button pattern:
 *   - Trigger has `aria-haspopup="menu"` + `aria-expanded`.
 *   - Menu panel uses `role="menu"`, items use `role="menuitemradio"`.
 *   - Arrow keys cycle focus through items (wrapping at edges).
 *   - Home / End jump to first / last item.
 *   - Enter / Space selects the focused item.
 *   - Escape closes the menu and returns focus to the trigger.
 *   - On mobile (fixed bottom-sheet) a focus trap prevents Tab from
 *     escaping behind the overlay.
 *
 * Items are `<button>` elements so they receive native focus rings,
 * are announced correctly by screen readers, and work with click,
 * touch, and keyboard out of the box.
 */
function ModeMenu({
    anchorRef,
    activeModeId,
    open,
    onToggle,
    onSelect,
}: ModeMenuProps) {
    const activeMode = getHeroMode(activeModeId);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // When the menu opens, focus the currently-active item so the
    // user can immediately navigate with arrow keys.
    useEffect(() => {
        if (!open) return;
        const activeIdx = HERO_MODES.findIndex((m) => m.id === activeModeId);
        const target = itemRefs.current[activeIdx >= 0 ? activeIdx : 0];
        // requestAnimationFrame so the DOM has painted the menu visible
        // before we attempt to focus inside it (CSS transition from
        // visibility: hidden → visible).
        requestAnimationFrame(() => target?.focus());
    }, [open, activeModeId]);

    // Focus trap for the mobile bottom-sheet: when the menu is open
    // and positioned as a fixed overlay (≤768px), Tab must not escape.
    useEffect(() => {
        if (!open) return;
        const menu = menuRef.current;
        if (!menu) return;

        const handleTrap = (e: KeyboardEvent) => {
            if (e.key !== "Tab") return;
            const focusable = menu.querySelectorAll<HTMLElement>(
                'button, [tabindex]:not([tabindex="-1"])',
            );
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        menu.addEventListener("keydown", handleTrap);
        return () => menu.removeEventListener("keydown", handleTrap);
    }, [open]);

    /** Arrow / Home / End / Escape keyboard navigation. */
    const handleMenuKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
            const currentIdx = items.indexOf(
                document.activeElement as HTMLButtonElement,
            );

            let nextIdx: number | null = null;

            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    nextIdx = (currentIdx + 1) % items.length;
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    nextIdx =
                        (currentIdx - 1 + items.length) % items.length;
                    break;
                case "Home":
                    e.preventDefault();
                    nextIdx = 0;
                    break;
                case "End":
                    e.preventDefault();
                    nextIdx = items.length - 1;
                    break;
                case "Escape":
                    e.preventDefault();
                    onToggle();
                    // Return focus to the trigger so the user doesn't
                    // lose their place in the page.
                    triggerRef.current?.focus();
                    return;
                default:
                    return;
            }

            if (nextIdx !== null) {
                items[nextIdx].focus();
            }
        },
        [onToggle],
    );

    return (
        <div className={styles.modeWrapper} ref={anchorRef}>
            <button
                ref={triggerRef}
                type="button"
                className={clsx(
                    styles.modeButton,
                    open && styles.modeButtonActive,
                )}
                onClick={onToggle}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`Mode: ${activeMode.label}`}
            >
                <span aria-hidden="true">{activeMode.icon}</span>
            </button>

            <div
                ref={menuRef}
                className={clsx(
                    styles.modeMenu,
                    open && styles.modeMenuOpen,
                )}
                role="menu"
                aria-label="Prompt destination"
                onKeyDown={handleMenuKeyDown}
            >
                {HERO_MODES.map((mode, index) => {
                    const isActive = mode.id === activeModeId;
                    return (
                        <button
                            key={mode.id}
                            ref={(el) => {
                                itemRefs.current[index] = el;
                            }}
                            type="button"
                            role="menuitemradio"
                            aria-checked={isActive}
                            tabIndex={isActive ? 0 : -1}
                            className={clsx(
                                styles.modeMenuItem,
                                isActive && styles.modeMenuItemActive,
                            )}
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
