import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

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
    // www→apex canonicalization lives in middleware.ts because OpenNext
    // does not interpolate `:path*` in redirect destinations.

    // Strip @vercel/og from the Worker bundle. Next.js pulls it in by
    // default for `ImageResponse`/OG routes, but this app generates no
    // OG images, so the ~2 MiB of wasm + JS is dead weight that pushed
    // the Worker past Cloudflare's 3/10 MiB size limit.
    turbopack: {
        resolveAlias: {
            "next/dist/compiled/@vercel/og/index.edge.js":
                "./lib/empty-module.js",
            "next/dist/compiled/@vercel/og/index.node.js":
                "./lib/empty-module.js",
        },
    },
};

export default nextConfig;
