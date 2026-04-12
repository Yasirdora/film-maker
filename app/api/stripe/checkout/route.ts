/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for a paid subscription plan and
 * returns the hosted checkout URL. The client redirects the browser to
 * that URL; Stripe handles payment collection end-to-end.
 *
 * Auth:
 *   Requires an authenticated user. Unauthenticated requests get 401
 *   and the client is expected to redirect to /login?from=/pricing.
 *
 * Input (JSON body):
 *   { planId: "indie" | "creator" | "studio" }
 *
 * Output:
 *   { url: string }
 *
 * Side effects:
 *   • Ensures a Stripe Customer exists for the user (idempotent).
 *   • Creates a Stripe Checkout Session in `subscription` mode.
 *   • Passes client_reference_id = userId + metadata so the webhook
 *     handler can recover the user from the session object.
 *
 * The user's credit grant happens in the webhook handler
 * (`checkout.session.completed`), not here — Stripe may have to capture
 * 3DS, SCA, or bank authorization before the payment settles.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import {
    ensureStripeCustomer,
    getStripe,
    getStripePriceId,
} from "@/lib/stripe";
import { isFreePlan } from "@/lib/constants";

const BodySchema = z.object({
    planId: z.enum(["indie", "creator", "studio"]),
});

export async function POST(request: Request): Promise<Response> {
    // ─── Auth ────────────────────────────────────────────────────────
    const result = await getSession();
    if (!result?.user) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 },
        );
    }
    const { user } = result;

    // ─── Input ───────────────────────────────────────────────────────
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

    if (isFreePlan(parsed.planId)) {
        return NextResponse.json(
            { error: "Cannot checkout the free plan" },
            { status: 400 },
        );
    }

    // ─── Stripe ──────────────────────────────────────────────────────
    const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        process.env.BETTER_AUTH_URL ??
        new URL(request.url).origin;

    try {
        const customerId = await ensureStripeCustomer({
            userId: user.id,
            email: user.email,
            name: user.name ?? null,
        });

        const priceId = getStripePriceId(parsed.planId);
        const stripe = getStripe();

        const checkoutSession = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            client_reference_id: user.id,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${appUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/pricing?cancelled=1`,
            allow_promotion_codes: true,
            automatic_tax: { enabled: true },
            customer_update: {
                address: "auto",
                name: "auto",
            },
            billing_address_collection: "auto",
            metadata: {
                film_maker_user_id: user.id,
                film_maker_plan_id: parsed.planId,
            },
            subscription_data: {
                metadata: {
                    film_maker_user_id: user.id,
                    film_maker_plan_id: parsed.planId,
                },
            },
        });

        if (!checkoutSession.url) {
            return NextResponse.json(
                { error: "Stripe did not return a checkout URL" },
                { status: 500 },
            );
        }

        return NextResponse.json({ url: checkoutSession.url });
    } catch (err) {
        console.error("Stripe checkout error:", err);
        return NextResponse.json(
            {
                error:
                    err instanceof Error
                        ? err.message
                        : "Failed to create checkout session",
            },
            { status: 500 },
        );
    }
}
