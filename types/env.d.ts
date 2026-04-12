/**
 * Global Cloudflare binding types.
 *
 * `@opennextjs/cloudflare` exposes the current Worker's environment via
 * `getCloudflareContext().env` typed as `CloudflareEnv`. This file tells
 * TypeScript what bindings that interface contains, so `env.DB` resolves
 * to D1Database and `env.STORAGE` resolves to R2Bucket.
 *
 * Keep in sync with wrangler.jsonc:
 *   - Add every new binding here and in wrangler.jsonc together.
 *   - Running `npm run cf-typegen` would also work (generates
 *     cloudflare-env.d.ts) but requires the remote account to be
 *     accessible. Hand-maintaining this file keeps CI / fresh-clone
 *     checkouts typechecking without remote credentials.
 */

export {};

declare global {
    interface CloudflareEnv {
        // ─── Public vars (mirrored from wrangler.jsonc `vars`) ──────────
        NEXT_PUBLIC_APP_URL: string;
        NEXT_PUBLIC_STORAGE_URL: string;

        // ─── Bindings ───────────────────────────────────────────────────
        DB: D1Database;
        STORAGE: R2Bucket;
    }
}
