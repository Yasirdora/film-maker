/**
 * /artistic-intelligence — Artistic Intelligence chat workspace.
 *
 * Available to every visitor — signed-in users get persistent history
 * and plan-based mode unlocks, signed-out visitors get three free
 * replies in chat mode (quota lives behind an HttpOnly cookie). The
 * server component only needs the session + plan to seed the client
 * workspace; everything else is fetched over /api/artistic-intelligence/* from the
 * browser.
 */

import type { Metadata } from "next";

import { getSession } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { AppNav } from "@/components/app-nav";
import { EditorHeaderAuthSlot } from "@/components/editor/EditorHeaderAuthSlot";
import ArtisticIntelligenceClient from "./ArtisticIntelligenceClient";

export const metadata: Metadata = {
    title: "Artistic Intelligence",
    description:
        "Chat with Artistic Intelligence, Film-maker's AI creative director — craft advice, screenplays, shot lists, and storyboards.",
};

export default async function ArtisticIntelligencePage() {
    const session = await getSession();

    if (!session?.user) {
        return (
            <>
                <AppNav hideArtisticIntelligenceIcon hideTopBar />
                <ArtisticIntelligenceClient
                    viewer={{ type: "anonymous" }}
                    authSlot={<EditorHeaderAuthSlot />}
                />
            </>
        );
    }

    const balance = await getBalance(session.user.id);
    const totalCredits =
        balance.subscriptionCredits + balance.purchasedCredits;

    return (
        <>
            <AppNav hideArtisticIntelligenceIcon hideTopBar />
            <ArtisticIntelligenceClient
                viewer={{
                    type: "authenticated",
                    planId: balance.plan,
                    totalCredits,
                }}
                authSlot={<EditorHeaderAuthSlot />}
            />
        </>
    );
}
