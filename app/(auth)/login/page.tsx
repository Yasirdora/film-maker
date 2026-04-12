import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
    title: "Sign in",
    description: "Sign in to Film-maker",
};

export default function LoginPage() {
    return (
        <div>
            <div className="space-y-2 text-center sm:text-left">
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                    Sign in to Film-maker
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Use Google or enter your email to receive a sign-in link.
                </p>
            </div>

            <Suspense fallback={null}>
                <LoginForm />
            </Suspense>

            <p className="mt-10 text-center text-xs text-neutral-500 dark:text-neutral-400">
                By continuing, you agree to the Terms of Service and Privacy
                Policy.
            </p>
        </div>
    );
}
