/**
 * /auteur — Auteur chat workspace.
 *
 * Available to every visitor — signed-in users get persistent history
 * and plan-based mode unlocks, signed-out visitors get three free
 * replies in chat mode (quota lives behind an HttpOnly cookie). The
 * server component only needs the session + plan to seed the client
 * workspace; everything else is fetched over /api/auteur/* from the
 * browser.
 */

import type { Metadata } from "next";

import { getSession } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { AppNav } from "@/components/app-nav";
import { AuteurWorkspace } from "./auteur-workspace";

export const metadata: Metadata = {
    title: "Auteur",
    description:
        "Chat with Auteur, Film-maker's AI creative director — craft advice, screenplays, shot lists, and storyboards.",
};

export default async function AuteurPage() {
    const session = await getSession();

    if (!session?.user) {
        return (
            <>
                <AppNav />
                <AuteurWorkspace viewer={{ type: "anonymous" }} />
            </>
        );
    }

    const balance = await getBalance(session.user.id);
    const totalCredits =
        balance.subscriptionCredits + balance.purchasedCredits;

    return (
        <>
            <AppNav />
            <AuteurWorkspace
                viewer={{
                    type: "authenticated",
                    planId: balance.plan,
                    totalCredits,
                }}
            />
        </>
    );
}
