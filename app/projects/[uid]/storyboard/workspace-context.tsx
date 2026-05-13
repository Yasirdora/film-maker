"use client";

/**
 * Per-mount Zustand store, exposed via React Context.
 *
 * The storyboard workspace is bootstrapped from server-rendered data
 * (server component → client component → context provider). We use a
 * context-scoped store rather than the module-level singleton pattern
 * because the page mounts a different storyboard per project — a
 * singleton would leak state across navigations.
 *
 * Children read via `useStoryboard(selector)` which is a thin wrapper
 * around Zustand's `useStore(store, selector)`.
 */

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";

import type { StoryboardBoard } from "@/lib/storyboards";

import {
    createStoryboardStore,
    type StoryboardStore,
} from "./workspace-store";

type StoreApi = ReturnType<typeof createStoryboardStore>;

const Ctx = createContext<StoreApi | null>(null);

export function StoryboardProvider({
    initial,
    children,
}: {
    initial: StoryboardBoard;
    children: ReactNode;
}) {
    // `useState` lazy initializer creates exactly one store per mount.
    // Under React 19 strict-mode double-invocation only the *render*
    // runs twice — the initializer ignores the second result, so we
    // get a single canonical store. Reading the ref's `current` during
    // render is what the eslint `react-hooks/refs` rule forbids; using
    // state instead is the idiomatic fix.
    const [store] = useState(() => createStoryboardStore(initial));
    return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStoryboard<T>(selector: (state: StoryboardStore) => T): T {
    const store = useContext(Ctx);
    if (!store) {
        throw new Error("useStoryboard must be used inside <StoryboardProvider>");
    }
    return useStore(store, selector);
}
