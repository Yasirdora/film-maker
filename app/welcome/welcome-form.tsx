"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface WelcomeFormProps {
    email: string;
}

export function WelcomeForm({ email }: WelcomeFormProps) {
    const router = useRouter();
    const [name, setName] = useState("");
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
            router.push("/dashboard");
            router.refresh();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong. Try again.",
            );
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} noValidate>
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
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
                    className="mt-4"
                >
                    {loading ? "Saving…" : "Get started"}
                </Button>
            </div>
        </form>
    );
}
