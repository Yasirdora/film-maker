"use client";

/**
 * WelcomeForm — two-step onboarding inside the auth card.
 *
 * Step 1: Name entry — matches the login form's visual language
 *         (same heading size, input height, button size, spacing).
 * Step 2: Solo plan confirmation — green check, perk list, two CTAs.
 *
 * Both steps render inside the AuthCard's right pane, so the brand
 * pane with the gradient and tagline stays visible throughout.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SOLO_DAILY_CREDIT_LIMIT } from "@/lib/constants";

interface WelcomeFormProps {
    email: string;
    credits: number;
}

type Step = "name-entry" | "complete";

export function WelcomeForm({ email, credits }: WelcomeFormProps) {
    const router = useRouter();
    const [step, setStep] = useState<Step>("name-entry");
    const [name, setName] = useState("");
    const [savedName, setSavedName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            setError("Please enter your name.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const { error: updateError } = await authClient.updateUser({
                name: trimmed,
            });
            if (updateError) {
                setError(updateError.message ?? "Couldn't save your name.");
                setLoading(false);
                return;
            }
            setSavedName(trimmed.split(" ")[0]);
            setStep("complete");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong. Try again.",
            );
            setLoading(false);
        }
    }

    // ─── Step 2: confirmation ───────────────────────────────────────
    if (step === "complete") {
        return (
            <div>
                <div className="mb-[clamp(1.5rem,3vw,2rem)] text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400">
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                        >
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-medium text-neutral-950 dark:text-neutral-50">
                        You&rsquo;re all set, {savedName}!
                    </h1>
                    <p className="mt-2 text-[0.9375rem] leading-relaxed text-neutral-500 dark:text-neutral-400">
                        Your free Solo plan is active.
                    </p>
                </div>

                <ul className="space-y-3 text-sm">
                    <Perk label={`${credits} credits every month`} />
                    <Perk label={`${SOLO_DAILY_CREDIT_LIMIT} credits per day`} />
                    <Perk label="1K resolution images" />
                    <Perk label="Personal use license" />
                </ul>

                <div className="mt-[clamp(1.5rem,3vw,2rem)] space-y-3">
                    <Button
                        variant="primary"
                        size="xl"
                        fullWidth
                        onClick={() => router.push("/pricing")}
                    >
                        Upgrade
                    </Button>
                    <button
                        type="button"
                        onClick={() => {
                            router.push("/dashboard");
                            router.refresh();
                        }}
                        className="flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
                    >
                        Continue as solo for free
                    </button>
                </div>
            </div>
        );
    }

    // ─── Step 1: name entry ─────────────────────────────────────────
    return (
        <div>
            <div className="mb-[clamp(1rem,2vw,1.5rem)]">
                <h1 className="mb-1 text-2xl font-medium text-neutral-950 dark:text-neutral-50">
                    One last thing
                </h1>
                <p className="text-[0.9375rem] leading-relaxed text-neutral-500 dark:text-neutral-400">
                    What should we call you?
                </p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
                <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
                    Signed in as{" "}
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {email}
                    </span>
                </p>

                <label htmlFor="name" className="sr-only">
                    Your name
                </label>
                <Input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    enterKeyHint="done"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        if (error) setError(null);
                    }}
                    disabled={loading}
                    className="h-14 px-5 text-[1.0625rem]"
                    autoFocus
                />

                {error && (
                    <p
                        role="alert"
                        className="mt-3 text-sm text-red-500 dark:text-red-400"
                    >
                        {error}
                    </p>
                )}

                <Button
                    type="submit"
                    variant="primary"
                    size="xl"
                    fullWidth
                    disabled={loading || !name.trim()}
                    className="mt-[clamp(1rem,2vw,1.5rem)]"
                >
                    {loading ? "Saving…" : "Get started"}
                </Button>
            </form>
        </div>
    );
}

function Perk({ label }: { label: string }) {
    return (
        <li className="flex items-center gap-2.5 text-neutral-700 dark:text-neutral-300">
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="shrink-0 text-green-500"
            >
                <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{label}</span>
        </li>
    );
}
