/**
 * Cloudflare binding accessor.
 *
 * Returns the request-scoped D1 and R2 bindings declared in wrangler.jsonc.
 * Uses OpenNext's official `getCloudflareContext()` so the call works in
 * both `next dev` (via the platform-proxy bridge set up in next.config.ts)
 * and in production Worker runs.
 *
 * Must only be called inside a request handler, server component, server
 * action, or middleware — there is no Cloudflare context at module load
 * time or in build-time code paths.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

/** Returns the D1 database binding for the current request. */
export function getDb(): D1Database {
    const { env } = getCloudflareContext();
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
export function getR2(): R2Bucket {
    const { env } = getCloudflareContext();
    if (!env.STORAGE) {
        throw new Error(
            "R2 binding `STORAGE` is not configured. Check wrangler.jsonc.",
        );
    }
    return env.STORAGE as unknown as R2Bucket;
}
