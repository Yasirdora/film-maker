/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session and returns its URL.
 *
 * Security:
 *   • Session-authenticated — unauthenticated requests get 401.
 *   • Origin-validated — rejects cross-origin POST (CSRF defense).
 *   • Stripe errors logged but not leaked to client.
 */

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import { getStripe } from "@/lib/stripe";
import { getDb } from "@/lib/db";

export async function POST(request: Request): Promise<Response> {
    // ─── CSRF ───────────────────────────────────────────────────────
    const originError = validateOrigin(request);
    if (originError) return originError;

    // ─── Auth ───────────────────────────────────────────────────────
    const result = await getSession();
    if (!result?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user } = result;

    const db = await getDb();
    const profile = await db
        .prepare("SELECT stripe_customer_id FROM user_profile WHERE user_id = ? LIMIT 1")
        .bind(user.id)
        .first<{ stripe_customer_id: string | null }>();

    if (!profile?.stripe_customer_id) {
        return NextResponse.json(
            { error: "No billing account yet. Upgrade to a paid plan first." },
            { status: 404 },
        );
    }

    const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        process.env.BETTER_AUTH_URL ??
        new URL(request.url).origin;

    try {
        const stripe = getStripe();
        const portal = await stripe.billingPortal.sessions.create({
            customer: profile.stripe_customer_id,
            return_url: `${appUrl}/credits`,
        });
        return NextResponse.json({ url: portal.url });
    } catch (err) {
        console.error("Stripe portal error:", err);
        return NextResponse.json(
            { error: "Could not open billing portal. Please try again." },
            { status: 500 },
        );
    }
}
