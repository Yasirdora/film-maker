"use client";

/**
 * Login form — client component.
 *
 * Two sign-in paths:
 *   1. Google OAuth
 *   2. Email OTP (6-digit code + auto-verify link in the same email)
 *
 * The email section only renders when the server tells us Gmail OAuth
 * is configured (`emailEnabled` prop).
 *
 * Flow: enter email → receive email with code + link → either type the
 * code into the app OR click the link in the email.
 */

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { authClient, signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TurnstileWidget } from "@/components/turnstile-widget";

type Status =
    | { kind: "idle" }
    | { kind: "submitting-google" }
    | { kind: "submitting-email" }
    | { kind: "code-entry"; email: string; error?: string }
    | { kind: "verifying"; email: string }
    | { kind: "error"; message: string };

const DEFAULT_CALLBACK = "/studio";
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function sanitizeCallback(raw: string | null): string {
    if (!raw) return DEFAULT_CALLBACK;
    if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_CALLBACK;
    return raw;
}

/**
 * Maps a Better Auth OTP send error to a human-readable message.
 * The raw error.message is often a terse HTTP phrase ("Too Many Requests")
 * or an internal code that means nothing to a user.
 */
function friendlyOtpSendError(error: { status?: number; message?: string }): string {
    if (error.status === 429) {
        return "Too many attempts. Please wait a moment and try again.";
    }
    if (error.status != null && error.status >= 500) {
        return "Something went wrong on our end. Please try again shortly.";
    }
    // Fall back to the raw message only if it's clearly user-facing text,
    // otherwise use a generic fallback.
    const msg = error.message ?? "";
    if (msg.length > 0 && msg.length < 120 && !/^\d{3}$/.test(msg)) {
        return msg;
    }
    return "Couldn't send the code. Try again.";
}

interface LoginFormProps {
    emailEnabled: boolean;
    turnstileSiteKey: string;
}

export function LoginForm({ emailEnabled, turnstileSiteKey }: LoginFormProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const callbackURL = sanitizeCallback(searchParams.get("from"));

    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [status, setStatus] = useState<Status>({ kind: "idle" });
    const [turnstileToken, setTurnstileToken] = useState<string | null>(
        turnstileSiteKey ? null : "skip",
    );

    const isSubmitting =
        status.kind === "submitting-google" ||
        status.kind === "submitting-email" ||
        status.kind === "verifying";

    // ─── Google OAuth ───────────────────────────────────────────────
    async function handleGoogle() {
        setStatus({ kind: "submitting-google" });
        try {
            await signIn.social({ provider: "google", callbackURL });
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

    // ─── Email OTP — request code ───────────────────────────────────
    async function handleEmail(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = email.trim().toLowerCase();
        if (!trimmed || !EMAIL_PATTERN.test(trimmed)) {
            setStatus({ kind: "error", message: "Enter a valid email address." });
            return;
        }

        setStatus({ kind: "submitting-email" });
        try {
            const { error } = await authClient.emailOtp.sendVerificationOtp({
                email: trimmed,
                type: "sign-in",
                fetchOptions: turnstileToken && turnstileToken !== "skip"
                    ? { headers: { "x-turnstile-token": turnstileToken } }
                    : undefined,
            });
            if (error) {
                setStatus({
                    kind: "error",
                    message: friendlyOtpSendError(error),
                });
                return;
            }
            setCode("");
            setStatus({ kind: "code-entry", email: trimmed });
        } catch {
            setStatus({
                kind: "error",
                message: "Couldn't send the code. Try again.",
            });
        }
    }

    // ─── Email OTP — verify code ────────────────────────────────────
    async function handleVerifyCode(e: React.FormEvent) {
        e.preventDefault();
        if (status.kind !== "code-entry") return;
        const trimmedCode = code.trim();
        if (!trimmedCode) return;

        const targetEmail = status.email;
        setStatus({ kind: "verifying", email: targetEmail });
        try {
            const { error } = await signIn.emailOtp({
                email: targetEmail,
                otp: trimmedCode,
            });
            if (error) {
                setCode("");
                setStatus({
                    kind: "code-entry",
                    email: targetEmail,
                    error: error.message ?? "Invalid or expired code. Try again.",
                });
                return;
            }
            router.push(callbackURL);
            router.refresh();
        } catch (err) {
            setCode("");
            setStatus({
                kind: "code-entry",
                email: targetEmail,
                error:
                    err instanceof Error
                        ? err.message
                        : "Verification failed. Try again.",
            });
        }
    }

    // ─── Resend code ────────────────────────────────────────────────
    async function handleResend() {
        if (status.kind !== "code-entry") return;
        const targetEmail = status.email;
        setStatus({ kind: "submitting-email" });
        try {
            const { error } = await authClient.emailOtp.sendVerificationOtp({
                email: targetEmail,
                type: "sign-in",
            });
            if (error) {
                setStatus({
                    kind: "code-entry",
                    email: targetEmail,
                    error: friendlyOtpSendError(error),
                });
                return;
            }
            setCode("");
            setStatus({ kind: "code-entry", email: targetEmail });
        } catch {
            setStatus({
                kind: "code-entry",
                email: targetEmail,
                error: "Couldn't resend the code. Try again.",
            });
        }
    }

    // ─── Code entry state ───────────────────────────────────────────
    if (status.kind === "code-entry" || status.kind === "verifying") {
        const sentEmail = status.email;
        const codeError = status.kind === "code-entry" ? status.error : undefined;
        return (
            <div>
                <div className="mb-[clamp(1rem,2vw,1.5rem)]">
                    <h1 className="mb-1 text-2xl font-medium text-neutral-950 dark:text-neutral-50">
                        Check your email
                    </h1>
                    <p className="text-[0.9375rem] leading-relaxed text-neutral-500 dark:text-neutral-400">
                        We sent a 6-digit code to{" "}
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">
                            {sentEmail}
                        </span>
                        . Enter it below or click the link in the email.
                    </p>
                </div>

                <form onSubmit={handleVerifyCode} noValidate>
                    <label htmlFor="otp" className="sr-only">
                        Verification code
                    </label>
                    <Input
                        id="otp"
                        name="otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        enterKeyHint="done"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={6}
                        placeholder="000000"
                        value={code}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                            setCode(val);
                        }}
                        disabled={status.kind === "verifying"}
                        className="h-14 px-5 text-center text-2xl font-mono tracking-[0.3em] placeholder:text-neutral-300 dark:placeholder:text-neutral-600"
                        autoFocus
                    />

                    {codeError && (
                        <p
                            role="alert"
                            className="mt-3 text-sm text-[var(--destructive)]"
                        >
                            {codeError}
                        </p>
                    )}

                    <Button
                        type="submit"
                        variant="primary"
                        size="xl"
                        fullWidth
                        disabled={status.kind === "verifying" || code.length < 6}
                        className="mt-[clamp(1rem,2vw,1.5rem)]"
                    >
                        {status.kind === "verifying" ? "Verifying…" : "Verify code"}
                    </Button>
                </form>

                <div className="mt-6 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={handleResend}
                        disabled={status.kind === "verifying"}
                        className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-50"
                    >
                        Resend code
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setCode("");
                            setStatus({ kind: "idle" });
                        }}
                        disabled={status.kind === "verifying"}
                        className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-50"
                    >
                        Use a different email
                    </button>
                </div>
            </div>
        );
    }

    // ─── Idle / submitting / error state ────────────────────────────
    return (
        <div>
            <div className="mb-[clamp(1rem,2vw,1.5rem)]">
                <h1 className="mb-1 text-3xl font-medium text-neutral-950 dark:text-neutral-50">
                    Welcome!
                </h1>
                <p className="text-[0.9375rem] leading-relaxed text-neutral-500 dark:text-neutral-400">
                    {emailEnabled
                        ? "Enter your email to get started."
                        : "Continue with Google to get started."}
                </p>
            </div>

            {emailEnabled && (
                <form onSubmit={handleEmail} className="mb-[clamp(1rem,2vw,1.5rem)]" noValidate>
                    <TurnstileWidget
                        siteKey={turnstileSiteKey}
                        onVerify={setTurnstileToken}
                        onExpire={() => setTurnstileToken(null)}
                    />
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
                        placeholder="Email address"
                        value={email}
                        onChange={(event) => {
                            setEmail(event.target.value);
                            if (status.kind === "error") setStatus({ kind: "idle" });
                        }}
                        disabled={isSubmitting}
                        className="h-14 px-5 text-[1.0625rem] placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                        autoFocus
                    />

                    {status.kind === "error" && (
                        <p
                            role="alert"
                            className="mt-3 text-sm text-[var(--destructive)]"
                        >
                            {status.message}
                        </p>
                    )}

                    <Button
                        type="submit"
                        variant="primary"
                        size="xl"
                        fullWidth
                        disabled={isSubmitting || !email || !turnstileToken}
                        className="mt-[clamp(1rem,2vw,1.5rem)]"
                    >
                        {status.kind === "submitting-email"
                            ? "Sending code…"
                            : "Continue with Email"}
                    </Button>
                </form>
            )}

            {emailEnabled ? (
                <Divider label="or continue with" />
            ) : (
                status.kind === "error" && (
                    <p
                        role="alert"
                        className="mb-4 text-sm text-[var(--destructive)]"
                    >
                        {status.message}
                    </p>
                )
            )}

            <div className={emailEnabled ? "grid grid-cols-1" : ""}>
                <Button
                    type="button"
                    variant="outline"
                    size="xl"
                    fullWidth
                    disabled={isSubmitting}
                    onClick={handleGoogle}
                    aria-label="Continue with Google"
                >
                    {status.kind === "submitting-google" ? (
                        <GoogleDotsLoader />
                    ) : (
                        <>
                            <GoogleIcon />
                            <span>Continue with Google</span>
                        </>
                    )}
                </Button>
            </div>

            <p className="mt-[clamp(2rem,4vw,3rem)] text-center text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                By continuing, you acknowledge our{" "}
                <a
                    href="/privacy"
                    className="underline decoration-neutral-300 underline-offset-[3px] transition-colors hover:text-neutral-900 hover:decoration-neutral-900 dark:decoration-neutral-700 dark:hover:text-neutral-50 dark:hover:decoration-neutral-50"
                >
                    Privacy Policy
                </a>{" "}
                and agree to our{" "}
                <a
                    href="/terms"
                    className="underline decoration-neutral-300 underline-offset-[3px] transition-colors hover:text-neutral-900 hover:decoration-neutral-900 dark:decoration-neutral-700 dark:hover:text-neutral-50 dark:hover:decoration-neutral-50"
                >
                    Terms of Service
                </a>
                .
            </p>
        </div>
    );
}

function Divider({ label }: { label: string }) {
    return (
        <div
            role="separator"
            aria-orientation="horizontal"
            className="relative mb-[clamp(1rem,2vw,1.5rem)] text-center text-[11px] uppercase tracking-[0.12em] text-neutral-400 dark:text-neutral-500"
        >
            <span className="relative z-10 px-3" style={{ backgroundColor: "var(--card-bg)" }}>
                {label}
            </span>
            <span className="absolute inset-x-0 top-1/2 -z-0 h-px bg-neutral-200 dark:bg-neutral-700/60" />
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

/**
 * Four-dot loader in Google's brand colors. Shown while the browser
 * is handing off to Google's OAuth consent screen so users see that
 * something is happening — same visual idiom Google itself uses.
 */
function GoogleDotsLoader() {
    return (
        <span
            className="flex items-center justify-center gap-1.5"
            role="status"
            aria-label="Redirecting to Google"
        >
            <span
                className="google-dot block h-2 w-2 rounded-full bg-[#4285F4]"
                style={{ animationDelay: "0ms" }}
            />
            <span
                className="google-dot block h-2 w-2 rounded-full bg-[#EA4335]"
                style={{ animationDelay: "160ms" }}
            />
            <span
                className="google-dot block h-2 w-2 rounded-full bg-[#FBBC05]"
                style={{ animationDelay: "320ms" }}
            />
            <span
                className="google-dot block h-2 w-2 rounded-full bg-[#34A853]"
                style={{ animationDelay: "480ms" }}
            />
        </span>
    );
}
