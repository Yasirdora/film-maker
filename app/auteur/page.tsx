/**
 * /auteur — the generation workspace.
 *
 * Where users type a prompt, configure options, and generate images.
 * This is the core product surface of Film-maker.
 *
 * Layout: on desktop, the form panel sits on the left and the result
 * canvas on the right. On mobile, they stack (form above, result below).
 *
 * Server component loads plan info for resolution gating. The form
 * itself is a client component that calls POST /api/generate.
 */

import type { Metadata } from "next";

import { requireOnboardedUser } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { getPlan, PHOTO_MODELS, RESOLUTIONS } from "@/lib/constants";
import { AppNav } from "@/components/app-nav";
import { GenerateForm } from "./generate-form";

export const metadata: Metadata = {
    title: "Create",
};

export default async function AuteurPage() {
    const { user } = await requireOnboardedUser();
    const balance = await getBalance(user.id);
    const plan = getPlan(balance.plan);

    // Build the list of resolutions available to this user's plan.
    const maxRes = plan?.maxResolution ?? "1K";
    const maxIdx = RESOLUTIONS.indexOf(maxRes);
    const availableResolutions = RESOLUTIONS.filter(
        (_, i) => i <= maxIdx,
    );

    const totalCredits =
        balance.subscriptionCredits + balance.purchasedCredits;

    return (
        <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
            <AppNav />

            <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
                <GenerateForm
                    models={PHOTO_MODELS.map((m) => ({
                        id: m.id,
                        name: m.name,
                        creditBase: m.creditBase,
                    }))}
                    availableResolutions={[...availableResolutions]}
                    planName={plan?.name ?? "Solo"}
                    maxResolution={maxRes}
                    totalCredits={totalCredits}
                />
            </main>
        </div>
    );
}
