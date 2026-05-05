"use client";

/**
 * NavProfileMenu — profile trigger + menu.
 *
 * Mobile: tab bar button that opens a full-screen bottom overlay.
 * Desktop: avatar button that opens a dropdown.
 *
 * Contains: user header, credits card, navigation links, sign out.
 *
 * All visual styling lives in nav-profile-menu.module.css and uses
 * the shared `--lp-*` design-token palette — no hardcoded hex values.
 */

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { signOut } from "@/lib/auth-client";
import { useCreditCount } from "@/lib/credit-store";

import styles from "./nav-profile-menu.module.css";

interface ProfileMenuProps {
    name: string;
    email: string;
    credits: number;
    planName: string;
    isFreePlan: boolean;
}

interface ProfileMenuContentProps extends ProfileMenuProps {
    initial: string;
    onNavigate: () => void;
    onSignOut: () => void;
    signingOut: boolean;
}

function ProfileMenuContent({
    initial,
    name,
    email,
    credits,
    planName,
    isFreePlan,
    onNavigate,
    onSignOut,
    signingOut,
}: ProfileMenuContentProps) {
    return (
        <>
            {/* User header */}
            <div className={styles.userHeader}>
                <div className={styles.userAvatar}>
                    <span className={styles.userAvatarInitial}>{initial}</span>
                </div>
                <div className={styles.userInfo}>
                    <p className={styles.userName}>{name}</p>
                    <p className={styles.userEmail}>{email}</p>
                </div>
            </div>

            {/* Credits card */}
            <Link
                href={isFreePlan ? "/pricing" : "/credits"}
                onClick={onNavigate}
                className={styles.creditsCard}
            >
                <div className={styles.creditsRow}>
                    <svg
                        className={styles.creditsIcon}
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span className={styles.creditsCount}>
                        {Intl.NumberFormat("en-US").format(credits)} credits
                    </span>
                    <span className={styles.creditsPlanBadge}>{planName}</span>
                </div>
                <span className={styles.creditsDescription}>
                    {isFreePlan
                        ? "Pick a plan and start creating."
                        : "Manage your plan and credits."}
                </span>
                <span className={styles.creditsCta}>
                    {isFreePlan ? "Get started free" : "Manage plan"}
                </span>
            </Link>

            {/* Navigation */}
            <Link
                href="/studio"
                onClick={onNavigate}
                className={styles.menuLink}
            >
                <svg
                    className={styles.menuIcon}
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
                Projects
            </Link>

            <hr className={styles.divider} />

            {/* Sign out */}
            <button
                type="button"
                onClick={onSignOut}
                disabled={signingOut}
                className={styles.menuButton}
            >
                <svg
                    className={styles.menuIcon}
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                {signingOut ? "Signing out…" : "Log out"}
            </button>
        </>
    );
}

// ─── Main component ─────────────────────────────────────────────────────────

interface NavProfileMenuProps extends ProfileMenuProps {
    /**
     * Layout mode.
     *
     *   "responsive" (default) — bottom-tab-bar trigger + full-screen
     *   overlay below 640px, avatar + dropdown above. Used by `AppNav`.
     *
     *   "avatar" — avatar trigger + dropdown at every breakpoint. Used
     *   by the landing-page header where there's no bottom tab bar.
     */
    variant?: "responsive" | "avatar";
}

export function NavProfileMenu({
    name,
    email,
    credits,
    planName,
    isFreePlan,
    variant = "responsive",
}: NavProfileMenuProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const desktopRef = useRef<HTMLDivElement>(null);

    // Live credit count — falls back to the server-rendered prop until
    // the shared store has been seeded by <CreditHydrator>.
    const liveCredits = useCreditCount(credits);

    const initial = (name || email)[0]?.toUpperCase() ?? "?";

    // Close dropdown on outside click or Escape.
    // In "responsive" mode below 640px the menu renders as a full-screen
    // overlay that owns its own dismissal (tap the Profile tab to close),
    // so the outside-click listener is skipped there. In "avatar" mode
    // the dropdown is the active surface at every breakpoint.
    useEffect(() => {
        if (!open) return;
        const isResponsiveVariant = variant === "responsive";
        function handleClick(e: MouseEvent) {
            if (
                isResponsiveVariant &&
                !window.matchMedia("(min-width: 640px)").matches
            ) {
                return;
            }
            if (
                desktopRef.current &&
                !desktopRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        }
        function handleEsc(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleEsc);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleEsc);
        };
    }, [open, variant]);

    async function handleSignOut() {
        setSigningOut(true);
        try {
            await signOut();
            router.push("/login");
            router.refresh();
        } catch {
            setSigningOut(false);
        }
    }

    const close = () => setOpen(false);

    const isResponsive = variant === "responsive";

    const contentProps: ProfileMenuContentProps = {
        initial,
        name,
        email,
        credits: liveCredits,
        planName,
        isFreePlan,
        onNavigate: close,
        onSignOut: handleSignOut,
        signingOut,
    };

    return (
        <>
            {/* ─── Bottom-tab-bar trigger + full-screen overlay (responsive only) ─── */}
            {isResponsive && (
                <>
                    <button
                        type="button"
                        onClick={() => setOpen(!open)}
                        className={styles.tabTrigger}
                        aria-expanded={open}
                        aria-label="Profile menu"
                    >
                        <div
                            className={clsx(
                                styles.tabIcon,
                                open
                                    ? styles.tabIconOpen
                                    : styles.tabIconDefault,
                            )}
                        >
                            {open ? (
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            ) : (
                                <span className={styles.tabIconInitial}>
                                    {initial}
                                </span>
                            )}
                        </div>
                        <span
                            className={clsx(
                                styles.tabLabel,
                                open
                                    ? styles.tabLabelOpen
                                    : styles.tabLabelDefault,
                            )}
                        >
                            Profile
                        </span>
                    </button>

                    {open && (
                        <div className={styles.mobileOverlay}>
                            <ProfileMenuContent {...contentProps} />
                        </div>
                    )}
                </>
            )}

            {/* ─── Avatar trigger + dropdown ─────────────────────────
                In "responsive" mode the desktop block is gated behind
                sm: (paired with the tab-bar trigger above). In
                "avatar" mode it's the only trigger and shows at every
                breakpoint. */}
            <div
                ref={desktopRef}
                className={clsx(
                    styles.desktopWrapper,
                    isResponsive && styles.desktopWrapperResponsive,
                )}
            >
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className={styles.avatarBubble}
                    aria-label="User menu"
                    aria-expanded={open}
                >
                    {initial}
                </button>

                {open && (
                    <div className={styles.dropdown}>
                        <ProfileMenuContent {...contentProps} />
                    </div>
                )}
            </div>
        </>
    );
}
