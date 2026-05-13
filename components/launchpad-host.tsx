"use client";

/**
 * LaunchpadHost — single source of truth for the Launchpad modal.
 *
 * Wraps `{children}` with a context that exposes `openLaunchpad`. Any
 * trigger (desktop pill, mobile bottom tab, debug menu, …) can open the
 * palette by calling that callback — they don't own state and don't
 * render their own dialog, so we avoid the "two triggers, two modals,
 * two ⌘K listeners" problem that arises when a button-style trigger
 * mounts both a mobile and a desktop variant on the same page.
 *
 * Mount this once near the root of the app (see `app/layout.tsx`).
 */

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";

import { Launchpad } from "./launchpad";

interface LaunchpadCtx {
    openLaunchpad: () => void;
}

const Ctx = createContext<LaunchpadCtx | null>(null);

export function LaunchpadHost({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const openLaunchpad = useCallback(() => setOpen(true), []);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setOpen((o) => !o);
            }
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    return (
        <Ctx.Provider value={{ openLaunchpad }}>
            {children}
            <Launchpad open={open} onClose={() => setOpen(false)} />
        </Ctx.Provider>
    );
}

/**
 * Returns a stable `openLaunchpad` callback. Returns a no-op outside of
 * a LaunchpadHost so trigger components can be rendered safely on pages
 * that haven't mounted the host (e.g. the landing page) — they just
 * won't open anything when clicked.
 */
export function useLaunchpad(): LaunchpadCtx {
    const ctx = useContext(Ctx);
    return ctx ?? { openLaunchpad: () => undefined };
}
