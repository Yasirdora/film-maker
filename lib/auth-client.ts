/**
 * Better Auth React client.
 *
 * Used by client components to call `signIn`, `signOut`, `useSession`,
 * and the email OTP plugin methods.
 */

"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL:
        typeof window !== "undefined" ? window.location.origin : undefined,
    plugins: [emailOTPClient()],
});

export const { signIn, signOut, useSession } = authClient;
