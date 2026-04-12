/**
 * /welcome — new-user onboarding inside the cinematic auth card.
 *
 * Uses the same two-pane AuthCard as /login so the visual flow from
 * sign-in → name entry → confirmation is seamless. The right pane
 * shows the WelcomeForm (name input → Solo plan confirmation).
 *
 * Privacy-preserving: the OTP flow is identical for new and existing
 * users. Name is collected here, after verification.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { getPlan } from "@/lib/constants";
import { AuthCard } from "../auth-card";
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
        <AuthCard>
            <WelcomeForm email={user.email} credits={credits} />
        </AuthCard>
    );
}
