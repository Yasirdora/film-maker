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
};

export default nextConfig;
