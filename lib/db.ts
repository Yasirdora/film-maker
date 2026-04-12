/**
 * Cloudflare binding accessor for Next.js routes running via OpenNext.
 *
 * OpenNext exposes the Cloudflare request context on a global Symbol so that
 * Worker bindings remain reachable inside the Next.js request lifecycle.
 * Bindings are objects (not strings), so they do NOT get copied into
 * `process.env` — we have to read them from the context directly.
 *
 * This pattern is ported verbatim from the `anthropist` reference project
 * where it's been running in production against D1. Do not rewrite it to
 * use `process.env.DB`, even if it "looks cleaner" — that path does not work
 * for D1/R2/KV bindings at runtime on Workers.
 */

import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

interface CloudflareContextEnv {
    DB: D1Database;
    STORAGE: R2Bucket;
    // Extend here as we add bindings to wrangler.jsonc.
}

interface CloudflareContext {
    env: CloudflareContextEnv;
}

const CONTEXT_SYMBOL = Symbol.for("__cloudflare-context__");

function getCloudflareContext(): CloudflareContext {
    const ctx = (globalThis as Record<symbol, unknown>)[CONTEXT_SYMBOL] as
        | CloudflareContext
        | undefined;
    if (!ctx) {
        throw new Error(
            "Cloudflare context not found. This helper must be called inside " +
            "a request handler running on OpenNext / Cloudflare Workers.",
        );
    }
    return ctx;
}

/** Returns the D1 database binding for the current request. */
export function getDb(): D1Database {
    const db = getCloudflareContext().env.DB;
    if (!db) {
        throw new Error("D1 binding `DB` is not configured in wrangler.jsonc");
    }
    return db;
}

/** Returns the R2 bucket binding for the current request. */
export function getR2(): R2Bucket {
    const r2 = getCloudflareContext().env.STORAGE;
    if (!r2) {
        throw new Error("R2 binding `STORAGE` is not configured in wrangler.jsonc");
    }
    return r2;
}
