"use client";

/**
 * Launchpad — Spotlight-style command palette.
 *
 * Triggered by the "Apps" nav button or Cmd+K / Ctrl+K keyboard
 * shortcut. Provides searchable access to all app destinations.
 *
 * Desktop: centered modal with backdrop blur.
 * Mobile: bottom sheet sliding up from the tab bar.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Destination registry ───────────────────────────────────────────────────

interface LaunchpadItem {
    id: string;
    title: string;
    subtitle: string;
    href: string;
    iconColor: "purple" | "orange" | "green";
    actionLabel: string;
    icon: React.ReactNode;
}

const LAUNCHPAD_ITEMS: LaunchpadItem[] = [
    {
        id: "auteur",
        title: "Auteur",
        subtitle: "AI creative assistant",
        href: "/auteur",
        iconColor: "orange",
        actionLabel: "Ask",
        icon: (
            <svg width="20" height="20" viewBox="0 0 19.5 19.5" fill="none">
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
        iconColor: "purple",
        actionLabel: "Open",
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
        ),
    },
    {
        id: "credits",
        title: "Credits",
        subtitle: "Balance and transaction history",
        href: "/credits",
        iconColor: "green",
        actionLabel: "Open",
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
        ),
    },
    {
        id: "pricing",
        title: "Pricing",
        subtitle: "Plans and upgrades",
        href: "/pricing",
        iconColor: "purple",
        actionLabel: "Open",
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M16 8h-6a2 2 0 100 4h4a2 2 0 110 4H8" />
                <path d="M12 18V6" />
            </svg>
        ),
    },
];

const ICON_BG: Record<string, string> = {
    purple: "bg-[rgba(168,85,247,0.1)] text-[#a855f7]",
    orange: "bg-[rgba(255,77,0,0.1)] text-[#FF4D00]",
    green: "bg-[rgba(16,185,129,0.1)] text-[#10b981]",
};

// ─── Component ──────────────────────────────────────────────────────────────

interface LaunchpadProps {
    open: boolean;
    onClose: () => void;
}

export function Launchpad({ open, onClose }: LaunchpadProps) {
    const [search, setSearch] = useState("");
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

    const navigate = useCallback(
        (href: string) => {
            onClose();
            router.push(href);
        },
        [onClose, router],
    );

    const filtered = LAUNCHPAD_ITEMS.filter(
        (item) =>
            item.title.toLowerCase().includes(search.toLowerCase()) ||
            item.subtitle.toLowerCase().includes(search.toLowerCase()),
    );

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-xl"
                onClick={onClose}
                aria-hidden
            />

            {/* Panel */}
            <div className="fixed z-[81] w-[calc(100%-32px)] max-w-[580px] overflow-hidden rounded-[20px] border border-white/[0.08] bg-[rgba(22,22,24,0.85)] shadow-[0_24px_48px_rgba(0,0,0,0.25),0_48px_80px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[40px] backdrop-saturate-150 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:left-1/2 sm:top-1/2 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:bottom-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:w-full max-sm:max-w-full max-sm:rounded-b-none max-sm:max-h-[85svh] max-sm:pb-[env(safe-area-inset-bottom,16px)]">
                {/* Search */}
                <div className="flex items-center gap-3.5 border-b border-white/[0.08] px-5 py-5 max-sm:px-4 max-sm:py-4">
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
                    <span className="hidden select-none rounded-md bg-white/[0.04] px-2.5 py-1 text-[12px] font-semibold tracking-wider text-[#52525b] sm:block">
                        ESC
                    </span>
                </div>

                {/* Items */}
                <ul className="max-h-[60vh] overflow-y-auto p-2.5 max-sm:p-2">
                    {filtered.length === 0 ? (
                        <li className="py-7 text-center text-[14px] text-[#52525b]">
                            No results found
                        </li>
                    ) : (
                        filtered.map((item) => (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    onClick={() => navigate(item.href)}
                                    className="flex w-full items-center gap-3.5 rounded-[14px] px-3.5 py-3 transition-colors hover:bg-white/[0.05] active:scale-[0.98] group"
                                >
                                    <div
                                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ICON_BG[item.iconColor]} max-sm:h-10 max-sm:w-10 max-sm:rounded-[10px]`}
                                    >
                                        {item.icon}
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-col items-start">
                                        <span className="text-[15px] font-semibold text-white leading-snug">
                                            {item.title}
                                        </span>
                                        <span className="mt-0.5 text-[12px] text-[#52525b]">
                                            {item.subtitle}
                                        </span>
                                    </div>
                                    <span className="text-[12px] font-semibold text-[#52525b] opacity-0 transition-opacity group-hover:opacity-100">
                                        {item.actionLabel}
                                    </span>
                                </button>
                            </li>
                        ))
                    )}
                </ul>
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
