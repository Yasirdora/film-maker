/**
 * /welcome — new-user onboarding.
 *
 * Two-step flow, both rendered by WelcomeForm (client component):
 *   1. Name entry — "What should we call you?"
 *   2. Confirmation — "You're all set!" with Solo plan details
 *
 * Privacy-preserving: the OTP flow is identical for new and existing
 * users. The name is collected here, after verification, not during
 * the email-entry step.
 *
 * Solo activation happens automatically in the databaseHooks user
 * create hook (100 credits granted at signup). This page just surfaces
 * what the user already has.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { getPlan } from "@/lib/constants";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = {
    title: "Welcome",
};

export default async function WelcomePage() {
    const { user } = await requireSession();

    if (user.name) {
        redirect("/dashboard");
    }

    const balance = await getBalance(user.id);
    const plan = getPlan(balance?.plan ?? "solo");
    const credits = plan?.credits ?? 100;

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
                <WelcomeForm email={user.email} credits={credits} />
            </div>
        </main>
    );
}
