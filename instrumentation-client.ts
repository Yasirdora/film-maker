/**
 * Client-side Sentry init.
 *
 * Picked up by `withSentryConfig` at build time and injected into the
 * client bundle. Captures unhandled errors and promise rejections in
 * the browser.
 *
 * If NEXT_PUBLIC_SENTRY_DSN is not set, Sentry silently disables
 * itself — no errors, no network requests, no overhead.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Sample 10% of transactions for performance monitoring.
    tracesSampleRate: 0.1,

    environment: process.env.NODE_ENV,

    // Disable replay — not needed for v0 and adds bundle weight.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
});
