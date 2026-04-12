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

export default nextConfig;
