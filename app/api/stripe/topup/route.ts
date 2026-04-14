/**
 * POST /api/stripe/topup
 *
 * Creates a Stripe Checkout Session for a one-time credit pack purchase.
 * The client redirects the browser to the returned URL; Stripe handles
 * payment collection. On success, the webhook grants purchased_credits.
 *
 * Separate from /api/stripe/checkout (subscriptions) because the Stripe
 * Checkout mode, validation logic, and fulfillment flow are different:
 *   • mode: "payment" (one-time) vs "subscription" (recurring)
 *   • packId (credit pack) vs planId (subscription tier)
 *   • Grants purchased_credits vs subscription_credits
 *
 * Security:
 *   • Session-authenticated — unauthenticated requests get 401.
 *   • Origin-validated — rejects cross-origin POST (CSRF defense).
 *   • Monthly spend ceiling enforced before creating the session.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import { ensureStripeCustomer, getStripe, getTopupPriceId } from "@/lib/stripe";
import { getCreditPack } from "@/lib/constants";
import { getMonthlyTopupAllowance } from "@/lib/credits";

const BodySchema = z.object({
    packId: z.enum(["small", "medium", "large"]),
});

export async function POST(request: Request): Promise<Response> {
    // ─── CSRF ───────────────────────────────────────────────────────
    const originError = validateOrigin(request);
    if (originError) return originError;

    // ─── Auth ───────────────────────────────────────────────────────
    const result = await getSession();
    if (!result?.user) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 },
        );
    }
    const { user } = result;

    // ─── Input ──────────────────────────────────────────────────────
    let parsed: z.infer<typeof BodySchema>;
    try {
        const body = await request.json();
        parsed = BodySchema.parse(body);
    } catch {
        return NextResponse.json(
            { error: "Invalid request body" },
            { status: 400 },
        );
    }

    const pack = getCreditPack(parsed.packId);
    if (!pack) {
        return NextResponse.json(
            { error: "Unknown credit pack" },
            { status: 400 },
        );
    }

    // ─── Monthly spend ceiling ──────────────────────────────────────
    const { remainingCents } = await getMonthlyTopupAllowance(user.id);
    if (remainingCents < pack.priceUsdCents) {
        return NextResponse.json(
            {
                error: "You've reached the monthly spending limit. " +
                    "Contact support if you need to increase it.",
            },
            { status: 403 },
        );
    }

    // ─── Stripe ─────────────────────────────────────────────────────
    const appUrl = new URL(request.url).origin;

    try {
        const customerId = await ensureStripeCustomer({
            userId: user.id,
            email: user.email,
            name: user.name ?? null,
        });

        const priceId = getTopupPriceId(parsed.packId);
        const stripe = getStripe();

        const checkoutSession = await stripe.checkout.sessions.create({
            mode: "payment",
            customer: customerId,
            client_reference_id: user.id,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${appUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/credits?cancelled=1`,
            automatic_tax: { enabled: true },
            metadata: {
                film_maker_user_id: user.id,
                film_maker_pack_id: parsed.packId,
            },
        });

        if (!checkoutSession.url) {
            return NextResponse.json(
                { error: "Could not start checkout. Please try again." },
                { status: 500 },
            );
        }

        return NextResponse.json({ url: checkoutSession.url });
    } catch (err) {
        console.error("Stripe topup checkout error:", err);
        return NextResponse.json(
            { error: "Could not start checkout. Please try again." },
            { status: 500 },
        );
    }
}
