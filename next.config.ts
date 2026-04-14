import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { withSentryConfig } from "@sentry/nextjs";

// Bridge `next dev` with Cloudflare's platform proxy so bindings (D1, R2,
// KV, Queues…) are reachable from server components and route handlers
// during local development.
//
// This is a no-op outside `next dev`. It's safe to call unconditionally
// and does not need to be awaited — OpenNext kicks the setup off in the
// background while Next boots up.
//
// Without this call, `getCloudflareContext()` throws at runtime because
// no Worker context exists in the plain Node-based Next dev runtime.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
    reactStrictMode: true,
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "storage.film-maker.net" },
        ],
    },
    async headers() {
        return [
            {
                // Apply security headers to all routes.
                source: "/(.*)",
                headers: [
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    {
                        key: "Strict-Transport-Security",
                        value: "max-age=63072000; includeSubDomains; preload",
                    },
                    {
                        key: "Permissions-Policy",
                        value: "camera=(), microphone=(), geolocation=()",
                    },
                ],
            },
        ];
    },
    async redirects() {
        return [
            // Canonicalize on the bare apex. Without this, users on
            // www.film-maker.net set OAuth state cookies on the www host,
            // but Google redirects back to the bare apex (per BETTER_AUTH_URL),
            // and the cookie isn't sent — causing state_mismatch errors.
            {
                source: "/:path*",
                has: [{ type: "host", value: "www.film-maker.net" }],
                destination: "https://film-maker.net/:path*",
                permanent: true,
            },
        ];
    },
};

export default withSentryConfig(nextConfig, {
    // Source maps: disable upload until SENTRY_AUTH_TOKEN is configured.
    // Enable later for production stack traces with original source.
    sourcemaps: { disable: true },

    // Suppress Sentry CLI output during build.
    silent: true,

    // Disable Sentry build telemetry.
    telemetry: false,
});
