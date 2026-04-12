/**
 * Cloudflare binding accessor.
 *
 * Returns the request-scoped D1 and R2 bindings declared in wrangler.jsonc.
 * Uses OpenNext's `getCloudflareContext()` in **async mode** because sync
 * mode relies on `initOpenNextCloudflareForDev` having populated a global
 * symbol in the same Node process that's serving the request — a
 * condition that does not hold reliably under Turbopack in `next dev`
 * (the two-process dev model means init may run in a different process
 * than the request handler).
 *
 * Async mode has a well-defined fallback: if the global symbol isn't set
 * AND we're in the Node runtime, it calls Wrangler's platform proxy
 * directly to fetch the context, caches it on global, and returns. First
 * call on a cold process pays a small setup cost; subsequent calls are
 * effectively free. In production (real Cloudflare Worker runtime) the
 * global symbol is always set by the entrypoint, so the fast path wins.
 *
 * Every caller of `getDb()` / `getR2()` must await — these are NOT sync.
 * Must only be called inside a request handler, server component, server
 * action, or middleware. There is no Cloudflare context at module load
 * time.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

/** Returns the D1 database binding for the current request. */
export async function getDb(): Promise<D1Database> {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.DB) {
        throw new Error(
            "D1 binding `DB` is not configured. " +
            "Check wrangler.jsonc, run `npm run db:create` if you haven't " +
            "created the database yet, then `npm run db:migrate:local`.",
        );
    }
    return env.DB as unknown as D1Database;
}

/** Returns the R2 bucket binding for the current request. */
export async function getR2(): Promise<R2Bucket> {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.STORAGE) {
        throw new Error(
            "R2 binding `STORAGE` is not configured. Check wrangler.jsonc.",
        );
    }
    return env.STORAGE as unknown as R2Bucket;
}
