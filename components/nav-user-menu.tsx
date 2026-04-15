"use client";

/**
 * NavUserMenu — user avatar with rich dropdown.
 *
 * Dropdown contents:
 *   • User header (avatar initial, name, email)
 *   • Credits card (balance, plan badge, CTA)
 *   • Navigation links (Projects, Settings)
 *   • Sign out
 *
 * Closes on outside click or Escape.
 */

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/lib/auth-client";

interface NavUserMenuProps {
    name: string;
    email: string;
    credits: number;
    planName: string;
    isFreePlan: boolean;
}

export function NavUserMenu({
    name,
    email,
    credits,
    planName,
    isFreePlan,
}: NavUserMenuProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click or Escape.
    useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
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

    const initial = (name || email)[0]?.toUpperCase() ?? "?";

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

    return (
        <div ref={ref} className="relative">
            {/* Avatar trigger */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.07] text-sm font-semibold text-[#9ca3af] ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.12] hover:ring-white/[0.15]"
                aria-label="User menu"
                aria-expanded={open}
            >
                {initial}
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-[320px] rounded-2xl border border-white/[0.08] bg-[#1a1a1c]/95 p-2 shadow-xl backdrop-blur-2xl">
                    {/* User header */}
                    <div className="flex items-center gap-3.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.07]">
                            <span className="text-[15px] font-medium text-[#9ca3af]">
                                {initial}
                            </span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-medium text-white">
                                {name}
                            </p>
                            <p className="mt-px truncate text-[13px] text-[#52525b]">
                                {email}
                            </p>
                        </div>
                    </div>

                    {/* Credits card */}
                    <Link
                        href={isFreePlan ? "/pricing" : "/credits"}
                        onClick={() => setOpen(false)}
                        className="mx-1 my-1.5 flex flex-col gap-3 rounded-xl border border-white/[0.06] p-4 transition-colors hover:border-white/[0.12]"
                    >
                        <div className="flex items-center gap-2">
                            <svg
                                className="shrink-0 text-[#9ca3af]"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.75"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden
                            >
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                            <span className="text-[14px] font-semibold text-white">
                                {Intl.NumberFormat("en-US").format(credits)} credits
                            </span>
                            <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[11px] font-medium text-[#52525b]">
                                {planName}
                            </span>
                        </div>
                        <span className="text-[13px] leading-relaxed text-[#52525b]">
                            {isFreePlan
                                ? "Pick a plan and start creating."
                                : "Manage your plan and credits."}
                        </span>
                        <span className="flex items-center justify-center rounded-lg bg-white py-2 text-[13px] font-semibold text-black transition-colors hover:bg-gray-200">
                            {isFreePlan ? "Upgrade" : "Manage plan"}
                        </span>
                    </Link>

                    {/* Navigation links */}
                    <Link
                        href="/studio"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-medium text-[#9ca3af] transition-colors hover:bg-white/[0.04] hover:text-white"
                    >
                        <svg
                            className="shrink-0 text-[#52525b]"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                        >
                            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                        </svg>
                        Projects
                    </Link>

                    <div className="mx-2 my-1 border-t border-white/[0.06]" />

                    {/* Sign out */}
                    <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={signingOut}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[14px] font-medium text-[#9ca3af] transition-colors hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
                    >
                        <svg
                            className="shrink-0 text-[#52525b]"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                        >
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                </div>
            )}
        </div>
    );
}
