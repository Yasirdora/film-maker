import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
    title: "Sign in",
    description: "Sign in to Film-maker",
};

/**
 * Returns true if all Gmail OAuth env vars are populated. We check at
 * render time so the login UI can silently drop the magic-link option
 * when the email pipeline isn't configured yet, instead of showing a
 * form that always fails. Same page, no redeploy required — flip the
 * vars in .dev.vars or `wrangler secret put`, restart dev, and the
 * section reappears.
 */
function isEmailSignInAvailable(): boolean {
    return Boolean(
        process.env.GMAIL_CLIENT_ID &&
        process.env.GMAIL_CLIENT_SECRET &&
        process.env.GMAIL_REFRESH_TOKEN &&
        process.env.GMAIL_SENDER,
    );
}

export default function LoginPage() {
    const emailEnabled = isEmailSignInAvailable();

    return (
        <div>
            <div className="space-y-2 text-center sm:text-left">
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                    Sign in to Film-maker
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {emailEnabled
                        ? "Use Google or enter your email to receive a sign-in link."
                        : "Continue with Google to get started."}
                </p>
            </div>

            <Suspense fallback={null}>
                <LoginForm emailEnabled={emailEnabled} />
            </Suspense>

            <p className="mt-10 text-center text-xs text-neutral-500 dark:text-neutral-400">
                By continuing, you agree to the Terms of Service and Privacy
                Policy.
            </p>
        </div>
    );
}
