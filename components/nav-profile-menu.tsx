"use client";

/**
 * NavProfileMenu — profile trigger + menu.
 *
 * Mobile: tab bar button that opens a full-screen bottom overlay.
 * Desktop: avatar button that opens a dropdown.
 *
 * Contains: user header, credits card, navigation links, sign out.
 */

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/lib/auth-client";

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
            <div className="flex items-center gap-3.5 rounded-xl px-3 py-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.07]">
                    <span className="text-[15px] font-medium text-[#9ca3af]">
                        {initial}
                    </span>
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-white">
                        {name}
                    </p>
                    <p className="mt-px truncate text-[13px] text-[#a1a1aa]">
                        {email}
                    </p>
                </div>
            </div>

            {/* Credits card */}
            <Link
                href={isFreePlan ? "/pricing" : "/credits"}
                onClick={onNavigate}
                className="mx-1 my-1.5 flex flex-col gap-3 rounded-xl border border-white/[0.06] p-4 transition-colors hover:border-white/[0.12]"
            >
                <div className="flex items-center gap-2">
                    <svg className="shrink-0 text-[#9ca3af]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span className="text-[14px] font-semibold text-white">
                        {Intl.NumberFormat("en-US").format(credits)} credits
                    </span>
                    <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[11px] font-medium text-[#a1a1aa]">
                        {planName}
                    </span>
                </div>
                <span className="text-[13px] leading-relaxed text-[#a1a1aa]">
                    {isFreePlan ? "Pick a plan and start creating." : "Manage your plan and credits."}
                </span>
                <span className="flex items-center justify-center rounded-lg bg-white py-2 text-[13px] font-semibold text-black transition-colors hover:bg-gray-200">
                    {isFreePlan ? "Get started free" : "Manage plan"}
                </span>
            </Link>

            {/* Navigation */}
            <Link
                href="/studio"
                onClick={onNavigate}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-medium text-[#9ca3af] transition-colors hover:bg-white/[0.04] hover:text-white"
            >
                <svg className="shrink-0 text-[#52525b]" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
                Projects
            </Link>

            <div className="mx-2 my-1 border-t border-white/[0.06]" />

            {/* Sign out */}
            <button
                type="button"
                onClick={onSignOut}
                disabled={signingOut}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[14px] font-medium text-[#9ca3af] transition-colors hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
            >
                <svg className="shrink-0 text-[#52525b]" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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

interface NavProfileMenuProps extends ProfileMenuProps {}

export function NavProfileMenu({
    name,
    email,
    credits,
    planName,
    isFreePlan,
}: NavProfileMenuProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const desktopRef = useRef<HTMLDivElement>(null);

    const initial = (name || email)[0]?.toUpperCase() ?? "?";

    // Close desktop dropdown on outside click or Escape.
    // The outside-click listener is desktop-only — on mobile the menu
    // renders as a full-screen overlay that owns its own dismissal (tap
    // the Profile tab again to close), so firing this globally would
    // collapse the overlay on any interaction inside it.
    useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            // Skip when the desktop dropdown isn't the active surface.
            if (!window.matchMedia("(min-width: 640px)").matches) return;
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
    }, [open]);

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

    return (
        <>
            {/* ─── Mobile: tab bar trigger ─────────────────────────── */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex flex-col items-center justify-center w-[25%] h-full gap-1 sm:hidden"
                aria-expanded={open}
                aria-label="Profile menu"
            >
                {open ? (
                    <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[#1c1c1e]">
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#9ca3af"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </div>
                ) : (
                    <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-white/[0.07] border border-white/[0.08]">
                        <span className="text-[15px] font-semibold text-[#9ca3af] leading-none">
                            {initial}
                        </span>
                    </div>
                )}
                <span className={`text-[11px] font-medium transition-colors ${open ? "text-[#52525b]" : "text-[#e5e7eb]"}`}>
                    Profile
                </span>
            </button>

            {/* ─── Mobile: full-screen overlay ─────────────────────── */}
            {open && (
                <div className="fixed inset-x-0 bottom-[66px] top-0 z-40 overflow-y-auto bg-[#0f0f11] p-4 pb-[env(safe-area-inset-bottom,16px)] sm:hidden">
                    <ProfileMenuContent initial={initial} name={name} email={email} credits={credits} planName={planName} isFreePlan={isFreePlan} onNavigate={close} onSignOut={handleSignOut} signingOut={signingOut} />
                </div>
            )}

            {/* ─── Desktop: avatar trigger ─────────────────────────── */}
            <div ref={desktopRef} className="relative hidden sm:block">
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.07] text-base font-semibold text-[#9ca3af] ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.12] hover:ring-white/[0.15]"
                    aria-label="User menu"
                    aria-expanded={open}
                >
                    {initial}
                </button>

                {/* Desktop dropdown */}
                {open && (
                    <div className="absolute right-0 top-[calc(100%+8px)] w-[320px] rounded-2xl border border-white/[0.08] bg-[#1a1a1c]/95 p-2 shadow-xl backdrop-blur-2xl">
                        <ProfileMenuContent initial={initial} name={name} email={email} credits={credits} planName={planName} isFreePlan={isFreePlan} onNavigate={close} onSignOut={handleSignOut} signingOut={signingOut} />
                    </div>
                )}
            </div>
        </>
    );
}
