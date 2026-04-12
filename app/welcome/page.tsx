/**
 * /welcome — new-user onboarding.
 *
 * Shown after a user's first successful email OTP verification if they
 * don't have a name set yet. Collects the name and updates their profile
 * before sending them to the dashboard.
 *
 * Privacy-preserving: the OTP flow is identical for new and existing
 * users (no email enumeration). The name is collected here, after
 * verification, instead of during the email-entry step.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-server";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = {
    title: "Welcome",
};

export default async function WelcomePage() {
    const { user } = await requireSession();

    // Already onboarded — skip straight to dashboard.
    if (user.name) {
        redirect("/dashboard");
    }

    return (
        <main className="min-h-dvh flex items-center justify-center px-6 bg-neutral-50 dark:bg-neutral-950">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                        Welcome to Film-maker
                    </h1>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                        What should we call you?
                    </p>
                </div>
                <WelcomeForm email={user.email} />
            </div>
        </main>
    );
}
