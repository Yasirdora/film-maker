/**
 * Next.js instrumentation hook — server-side Sentry init.
 *
 * The `register()` function runs once when the server starts (or on
 * cold start for Cloudflare Workers). It initializes Sentry for
 * server-side error tracking in API routes and server components.
 *
 * If SENTRY_DSN is not set, the init call is a no-op — Sentry
 * silently disables itself without affecting the application.
 */

import * as Sentry from "@sentry/nextjs";

export function register() {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,

        // Sample 10% of transactions for performance monitoring.
        // Adjust upward for low-traffic v0, downward at scale.
        tracesSampleRate: 0.1,

        environment: process.env.NODE_ENV,
    });
}
