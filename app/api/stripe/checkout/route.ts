/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for a paid subscription plan and
 * returns the hosted checkout URL. The client redirects the browser to
 * that URL; Stripe handles payment collection end-to-end.
 *
 * Security:
 *   • Session-authenticated — unauthenticated requests get 401.
 *   • Origin-validated — rejects cross-origin POST (CSRF defense).
 *   • Stripe errors are logged server-side but never leaked to the
 *     client — only generic user-facing messages are returned.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import {
    ensureStripeCustomer,
    getStripe,
    getStripePriceId,
} from "@/lib/stripe";
import { isFreePlan, getPlan, PAID_PLANS_ENABLED } from "@/lib/constants";
import { getMonthlyTopupAllowance } from "@/lib/credits";

const BodySchema = z.object({
    planId: z.enum(["indie", "creator", "studio"]),
});

export async function POST(request: Request): Promise<Response> {
    // ─── CSRF ───────────────────────────────────────────────────────
    const originError = validateOrigin(request);
    if (originError) return originError;

    // ─── Kill switch ────────────────────────────────────────────────
    // Paid plans are disabled during the public testing phase. The
    // pricing page hides the CTA; this is the server-side counterpart
    // so crafted requests can't bypass the UI gate.
    if (!PAID_PLANS_ENABLED) {
        return NextResponse.json(
            {
                error: "Paid plans are not available yet — Film-maker is in its public testing phase. The free Solo tier is active.",
            },
            { status: 503 },
        );
    }

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

    if (isFreePlan(parsed.planId)) {
        return NextResponse.json(
            { error: "Cannot checkout the free plan" },
            { status: 400 },
        );
    }

    // ─── Monthly topup ceiling ──────────────────────────────────────
    const plan = getPlan(parsed.planId);
    if (plan) {
        const { remainingCents } = await getMonthlyTopupAllowance(user.id);
        if (remainingCents < plan.priceUsdCents) {
            return NextResponse.json(
                {
                    error: "You've reached the monthly spending limit. " +
                        "Contact support if you need to increase it.",
                },
                { status: 403 },
            );
        }
    }

    // ─── Stripe ─────────────────────────────────────────────────────
    // Use the actual request origin — reliable on Cloudflare Workers and
    // avoids build-time env vars (NEXT_PUBLIC_*) baking in localhost.
    const appUrl = new URL(request.url).origin;

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
                { error: "Could not start checkout. Please try again." },
                { status: 500 },
            );
        }

        return NextResponse.json({ url: checkoutSession.url });
    } catch (err) {
        // Log the real Stripe error server-side for debugging.
        console.error("Stripe checkout error:", err);
        // Return a generic message — never expose Stripe internals.
        return NextResponse.json(
            { error: "Could not start checkout. Please try again." },
            { status: 500 },
        );
    }
}
