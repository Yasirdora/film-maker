/**
 * Better Auth React client.
 *
 * Used by client components to call `signIn`, `signOut`, `useSession`,
 * and the magic-link plugin's methods. Does NOT run any server code —
 * just forwards requests to /api/auth/*.
 */

"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    // Defaults to window.location.origin, which is what we want in the
    // browser. Explicit here only to document the behavior.
    baseURL:
        typeof window !== "undefined" ? window.location.origin : undefined,
    plugins: [magicLinkClient()],
});

export const { signIn, signOut, useSession, magicLink } = authClient;
