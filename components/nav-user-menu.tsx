"use client";

/**
 * NavUserMenu — user avatar + dropdown for the navigation bar.
 *
 * Renders the user's initial in a circle. On click, shows a dropdown
 * with the user's name/email and a sign-out button. Click outside
 * or Escape to close.
 */

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

interface NavUserMenuProps {
    name: string;
    email: string;
}

export function NavUserMenu({ name, email }: NavUserMenuProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click.
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
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] text-sm font-medium text-[#9ca3af] ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.12] hover:ring-white/[0.15]"
                aria-label="User menu"
                aria-expanded={open}
            >
                {initial}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-white/[0.08] bg-[#1a1a1c]/95 p-1 shadow-xl backdrop-blur-2xl">
                    <div className="px-3 py-2.5">
                        <div className="text-sm font-medium text-white">
                            {name}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-[#52525b]">
                            {email}
                        </div>
                    </div>
                    <div className="my-1 h-px bg-white/[0.06]" />
                    <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={signingOut}
                        className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-[#9ca3af] transition-colors hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
                    >
                        {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                </div>
            )}
        </div>
    );
}
