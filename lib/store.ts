/**
 * Tiny external store — Zustand-shaped, zero dependencies.
 *
 * API surface:
 *   createStore(initial)  → { getState, setState, subscribe }
 *   useStore(store)       → full state
 *   useStore(store, sel)  → derived slice (re-renders only when slice changes)
 *
 * Built on `useSyncExternalStore` so it's concurrent-mode and SSR safe.
 * The third arg (`getServerSnapshot`) mirrors `getState` — the store's
 * initial value is the server snapshot. For modules marked `"use client"`
 * this is fine: the store is created once per client bundle, and the
 * initial value is returned during SSR before any effects run.
 */

import { useSyncExternalStore } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Store<T> {
    /** Return the current state snapshot. */
    getState: () => T;
    /**
     * Replace state with an absolute value or an updater function.
     * Subscribers are notified synchronously if the new state differs
     * from the previous (compared via `Object.is`).
     */
    setState: (next: T | ((prev: T) => T)) => void;
    /**
     * Register a listener that fires on every state change.
     * Returns an unsubscribe function.
     */
    subscribe: (listener: () => void) => () => void;
}

// ─── createStore ───────────────────────────────────────────────────────────

export function createStore<T>(initialState: T): Store<T> {
    let state: T = initialState;
    const listeners = new Set<() => void>();

    return {
        getState: () => state,

        setState: (next) => {
            const prev = state;
            state =
                typeof next === "function"
                    ? (next as (prev: T) => T)(prev)
                    : next;
            if (!Object.is(prev, state)) {
                listeners.forEach((l) => l());
            }
        },

        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}

// ─── useStore ──────────────────────────────────────────────────────────────

/**
 * Subscribe a React component to a store. Optionally pass a selector
 * to derive a slice — the component only re-renders when the selected
 * value changes (compared via `Object.is`, same as Zustand).
 */
export function useStore<T>(store: Store<T>): T;
export function useStore<T, S>(store: Store<T>, selector: (state: T) => S): S;
export function useStore<T, S>(
    store: Store<T>,
    selector?: (state: T) => S,
): T | S {
    const select = selector ?? ((s: T) => s as unknown as S);
    return useSyncExternalStore(
        store.subscribe,
        () => select(store.getState()),
        () => select(store.getState()),
    );
}
