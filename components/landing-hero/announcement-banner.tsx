"use client";

/**
 * Floating "private beta" banner anchored to the top of the hero. It
 * morphs between three states:
 *
 *   • collapsed — single-line headline + "+" button to expand
 *   • expanded  — reveals copy and an email-capture form
 *   • thanked   — success message after a successful signup
 *
 * Submissions hit POST /api/waitlist. The server accepts an anonymous
 * `{ email, turnstileToken }` body (see app/api/waitlist/route.ts). If
 * a Turnstile site key is configured the widget is rendered inline and
 * the submit button stays disabled until the user passes the challenge.
 */

import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import {
    TurnstileWidget,
    type TurnstileWidgetHandle,
} from "@/components/turnstile-widget";

import styles from "./announcement-banner.module.css";

type SubmitStatus =
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "success" }
    | { kind: "error"; message: string };

/**
 * Turnstile gate state.
 *
 *   • `disabled` — no site key configured; the form is unprotected and
 *                  always passes the gate (typical in local dev).
 *   • `pending`  — site key configured, no token yet.
 *   • `verified` — Turnstile produced a token; ready to submit.
 *
 * The discriminated `kind` keeps the three meanings unambiguous in code
 * and means we never have to invent a sentinel token to represent
 * "Turnstile is off."
 */
type TurnstileGate =
    | { kind: "disabled" }
    | { kind: "pending" }
    | { kind: "verified"; token: string };

interface AnnouncementBannerProps {
    headline: string;
    body: ReactNode;
    /** Turnstile site key — pass an empty string to skip bot protection. */
    turnstileSiteKey: string;
}

export function AnnouncementBanner({
    headline,
    body,
    turnstileSiteKey,
}: AnnouncementBannerProps) {
    const turnstileEnabled = turnstileSiteKey.length > 0;
    const initialGate: TurnstileGate = turnstileEnabled
        ? { kind: "pending" }
        : { kind: "disabled" };

    const [isOpen, setIsOpen] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<SubmitStatus>({ kind: "idle" });
    const [gate, setGate] = useState<TurnstileGate>(initialGate);
    const turnstileRef = useRef<TurnstileWidgetHandle>(null);

    /** Drop any verified token and ask the widget for a fresh one. */
    const resetGate = useCallback(() => {
        if (!turnstileEnabled) return;
        setGate({ kind: "pending" });
        turnstileRef.current?.reset();
    }, [turnstileEnabled]);

    const isSubmitting = status.kind === "submitting";

    const handleToggle = useCallback(() => {
        // Block dismissal while a request is in-flight to avoid a race
        // between the response handler and the unmounting animation.
        if (isSubmitting) return;

        // In the expanded state the "+" turns into a close: one more
        // click dismisses the banner entirely. This matches the ConveX
        // reference and keeps the affordance count to one.
        if (isExpanded) {
            setIsOpen(false);
            return;
        }
        setIsExpanded(true);
    }, [isExpanded, isSubmitting]);

    const handleSubmit = useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const trimmed = email.trim();
            if (!trimmed) return;

            setStatus({ kind: "submitting" });

            try {
                const response = await fetch("/api/waitlist", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: trimmed,
                        turnstileToken:
                            gate.kind === "verified" ? gate.token : undefined,
                    }),
                });

                if (!response.ok) {
                    const data = (await response.json().catch(() => null)) as
                        | { error?: string }
                        | null;
                    setStatus({
                        kind: "error",
                        message:
                            data?.error ??
                            "Something went wrong. Please try again.",
                    });
                    // Token was consumed — reset widget for a fresh one.
                    resetGate();
                    return;
                }

                setStatus({ kind: "success" });
            } catch {
                setStatus({
                    kind: "error",
                    message: "Network error. Please try again.",
                });
                // Network failure may or may not have consumed the token.
                // Reset defensively so the retry always has a fresh one.
                resetGate();
            }
        },
        [email, gate, resetGate],
    );

    const canSubmit =
        status.kind !== "submitting" &&
        email.trim().length > 0 &&
        gate.kind !== "pending";

    return (
        <div className={styles.announcementWrapper}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="banner"
                        className={styles.announcementBanner}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{
                            opacity: { duration: 0.35 },
                            y: { duration: 0.35 },
                            scale: { duration: 0.25 },
                        }}
                    >
                        <div className={styles.announcementHeader}>
                            <span className={styles.announcementText}>
                                {headline}
                            </span>

                            <button
                                type="button"
                                className={styles.announcementButton}
                                aria-label={
                                    isExpanded ? "Dismiss" : "Read more"
                                }
                                aria-expanded={isExpanded}
                                onClick={handleToggle}
                            >
                                <motion.svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    animate={{ rotate: isExpanded ? 45 : 0 }}
                                    transition={{
                                        duration: 0.3,
                                        ease: [0.4, 0, 0.2, 1],
                                    }}
                                    aria-hidden="true"
                                >
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </motion.svg>
                            </button>
                        </div>

                        <AnimatePresence initial={false}>
                            {isExpanded && (
                                <motion.div
                                    key="body"
                                    className={styles.announcementBody}
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{
                                        duration: 0.5,
                                        ease: [0.2, 0.8, 0.2, 1],
                                    }}
                                >
                                    <p className={styles.announcementParagraph}>
                                        {body}
                                    </p>

                                    {status.kind === "success" ? (
                                        <div
                                            className={
                                                styles.announcementSuccess
                                            }
                                            role="status"
                                        >
                                            Thanks — we&apos;ll be in touch.
                                        </div>
                                    ) : (
                                        <form
                                            className={styles.announcementForm}
                                            onSubmit={handleSubmit}
                                            noValidate
                                        >
                                            <input
                                                type="email"
                                                required
                                                inputMode="email"
                                                autoComplete="email"
                                                placeholder="you@example.com"
                                                className={
                                                    styles.announcementInput
                                                }
                                                value={email}
                                                onChange={(e) =>
                                                    setEmail(e.target.value)
                                                }
                                                disabled={
                                                    status.kind === "submitting"
                                                }
                                                aria-label="Email address"
                                            />
                                            <button
                                                type="submit"
                                                className={
                                                    styles.announcementSubmit
                                                }
                                                disabled={!canSubmit}
                                            >
                                                {status.kind === "submitting"
                                                    ? "Sending…"
                                                    : "Notify me"}
                                            </button>
                                        </form>
                                    )}

                                    {status.kind === "error" && (
                                        <p
                                            role="alert"
                                            className={styles.announcementError}
                                        >
                                            {status.message}
                                        </p>
                                    )}

                                    {turnstileEnabled &&
                                        status.kind !== "success" && (
                                            <TurnstileWidget
                                                ref={turnstileRef}
                                                siteKey={turnstileSiteKey}
                                                onVerify={(token) =>
                                                    setGate({
                                                        kind: "verified",
                                                        token,
                                                    })
                                                }
                                                onExpire={() =>
                                                    setGate({ kind: "pending" })
                                                }
                                            />
                                        )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
