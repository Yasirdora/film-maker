"use client";

/**
 * Shared credit balance store.
 *
 * Replaces the per-component `useState(totalCredits)` pattern so that
 * every consumer — nav menu, project workspace, composer, Auteur —
 * sees the same live number without a page refresh.
 *
 * SSR strategy:
 *   The store starts as `null` (not yet seeded). During SSR and the
 *   first client render, `useSyncExternalStore` returns `null`, and
 *   the `useCreditCount(fallback)` hook falls back to the prop value
 *   the server component passed down — zero hydration mismatch.
 *
 *   After hydration, `<CreditHydrator>` fires a `useEffect` that
 *   seeds the store with the server-fresh value. From that point on
 *   the store is the single source of truth.
 *
 * Mutation helpers:
 *   • `adjustCredits(delta)` — optimistic deduction after a generation
 *   • `setCredits(value)`    — absolute set from SSE balance events
 */

import { useEffect } from "react";
import { createStore, useStore, type Store } from "./store";

// ─── Store instance (singleton) ────────────────────────────────────────────
//
// `globalThis` guard: Next.js may duplicate "use client" modules across
// chunk boundaries (nav vs. workspace bundles). Without this, each chunk
// gets its own `creditStore` instance and writes from one are invisible
// to the other. `Symbol.for` returns the SAME symbol across chunks, so
// the store is truly shared even if the module code runs twice.

const CREDIT_STORE_KEY = Symbol.for("fm.creditStore");
const _global = globalThis as unknown as Record<symbol, Store<number | null>>;

export const creditStore: Store<number | null> =
    _global[CREDIT_STORE_KEY] ??= createStore<number | null>(null);

// ─── Hooks ─────────────────────────────────────────────────────────────────

/**
 * Read the current credit count. Returns `fallback` until the store
 * has been seeded by `<CreditHydrator>`.
 */
export function useCreditCount(fallback: number): number {
    const value = useStore(creditStore);
    return value ?? fallback;
}

// ─── Mutation helpers ──────────────────────────────────────────────────────

/**
 * Adjust the credit count by a delta (negative to deduct, positive
 * to refund). No-op if the store hasn't been seeded yet.
 */
export function adjustCredits(delta: number): void {
    creditStore.setState((prev) => (prev !== null ? prev + delta : prev));
}

/**
 * Set the credit count to an absolute value. Used by:
 *   • `CreditHydrator` — seeds from server-rendered props
 *   • Auteur SSE — pushes real-time balance from the server
 */
export function setCredits(value: number): void {
    creditStore.setState(value);
}

// ─── Hydrator ──────────────────────────────────────────────────────────────

/**
 * Drop-in client component — place in any server component that knows
 * the authoritative credit count. Seeds the store after hydration so
 * every subscriber picks up the server-fresh value.
 *
 * Multiple instances on the same page are harmless; they all receive
 * the same prop from the same DB read.
 *
 * Renders nothing — zero layout cost.
 */
export function CreditHydrator({ credits }: { credits: number }): null {
    useEffect(() => {
        creditStore.setState(credits);
    }, [credits]);
    return null;
}
