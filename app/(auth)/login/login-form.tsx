"use client";

/**
 * Login form — client component.
 *
 * Handles both sign-in paths:
 *   1. Google OAuth (delegates to Better Auth's social-sign-in endpoint)
 *   2. Email magic link (calls the magic-link plugin, shows a success state)
 *
 * The email section only renders when the server tells us Gmail OAuth is
 * configured (`emailEnabled` prop). This avoids showing users a form that
 * always fails with 500 because the upstream Gmail REST API isn't set up
 * yet. When email eventually lands, the prop flips and the UI expands.
 *
 * UX details:
 *   • The `from` query param is preserved so post-sign-in redirect lands
 *     the user back where they came from.
 *   • Inline error messaging — no modals, no toasts.
 *   • Loading states on both buttons, disabled during submission.
 *   • On magic-link success we swap to a "check your email" view.
 */

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status =
    | { kind: "idle" }
    | { kind: "submitting-google" }
    | { kind: "submitting-email" }
    | { kind: "email-sent"; email: string }
    | { kind: "error"; message: string };

const DEFAULT_CALLBACK = "/dashboard";

function sanitizeCallback(raw: string | null): string {
    // Only allow same-origin absolute paths to prevent open-redirect abuse.
    if (!raw) return DEFAULT_CALLBACK;
    if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_CALLBACK;
    return raw;
}

interface LoginFormProps {
    emailEnabled: boolean;
}

export function LoginForm({ emailEnabled }: LoginFormProps) {
    const searchParams = useSearchParams();
    const callbackURL = sanitizeCallback(searchParams.get("from"));

    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<Status>({ kind: "idle" });

    const isSubmitting =
        status.kind === "submitting-google" ||
        status.kind === "submitting-email";

    async function handleGoogle() {
        setStatus({ kind: "submitting-google" });
        try {
            await signIn.social({ provider: "google", callbackURL });
            // signIn.social navigates to Google — execution halts here.
        } catch (err) {
            setStatus({
                kind: "error",
                message:
                    err instanceof Error
                        ? err.message
                        : "Couldn't start Google sign-in. Try again.",
            });
        }
    }

    async function handleEmail(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = email.trim().toLowerCase();
        if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
            setStatus({
                kind: "error",
                message: "Enter a valid email address.",
            });
            return;
        }

        setStatus({ kind: "submitting-email" });
        try {
            const { error } = await signIn.magicLink({
                email: trimmed,
                callbackURL,
            });
            if (error) {
                setStatus({
                    kind: "error",
                    message: error.message ?? "Couldn't send the link. Try again.",
                });
                return;
            }
            setStatus({ kind: "email-sent", email: trimmed });
        } catch (err) {
            setStatus({
                kind: "error",
                message:
                    err instanceof Error
                        ? err.message
                        : "Couldn't send the link. Try again.",
            });
        }
    }

    // ─── Success state ──────────────────────────────────────────────────
    if (status.kind === "email-sent") {
        return (
            <div className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-950">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-900">
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                    >
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                    </svg>
                </div>
                <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
                    Check your email
                </h2>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                    We sent a sign-in link to{" "}
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {status.email}
                    </span>
                    . The link expires in 15 minutes.
                </p>
                <Button
                    variant="ghost"
                    size="sm"
                    className="mt-6"
                    onClick={() => setStatus({ kind: "idle" })}
                >
                    Use a different email
                </Button>
            </div>
        );
    }

    // ─── Idle / submitting / error state ────────────────────────────────
    return (
        <div className="mt-10 space-y-6">
            <Button
                type="button"
                variant="outline"
                size="lg"
                fullWidth
                disabled={isSubmitting}
                onClick={handleGoogle}
                aria-label="Continue with Google"
            >
                {status.kind === "submitting-google" ? (
                    <span className="text-neutral-500">Redirecting…</span>
                ) : (
                    <>
                        <GoogleIcon />
                        <span>Continue with Google</span>
                    </>
                )}
            </Button>

            {emailEnabled && (
                <>
                    <div
                        role="separator"
                        aria-orientation="horizontal"
                        className="relative text-center text-xs uppercase tracking-wider text-neutral-400"
                    >
                        <span className="relative z-10 bg-neutral-50 px-3 dark:bg-neutral-950">
                            or
                        </span>
                        <span className="absolute inset-x-0 top-1/2 -z-0 h-px bg-neutral-200 dark:bg-neutral-800" />
                    </div>

                    <form onSubmit={handleEmail} className="space-y-3" noValidate>
                        <label htmlFor="email" className="sr-only">
                            Email address
                        </label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            enterKeyHint="send"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                            required
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (status.kind === "error") setStatus({ kind: "idle" });
                            }}
                            disabled={isSubmitting}
                        />
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            fullWidth
                            disabled={isSubmitting || !email}
                        >
                            {status.kind === "submitting-email"
                                ? "Sending…"
                                : "Send sign-in link"}
                        </Button>
                    </form>
                </>
            )}

            {status.kind === "error" && (
                <p
                    role="alert"
                    className="text-center text-sm text-red-600 dark:text-red-400"
                >
                    {status.message}
                </p>
            )}
        </div>
    );
}

function GoogleIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            aria-hidden
            className="shrink-0"
        >
            <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
            />
            <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
            />
            <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
            />
            <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
            />
        </svg>
    );
}
