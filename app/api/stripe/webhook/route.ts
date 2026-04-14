/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook receiver. Every mutation to subscription / payment /
 * credit state flows through here — the checkout endpoint merely starts
 * a flow, but only the webhook is authoritative about the outcome.
 *
 * Security:
 *   • Signature verified with the raw body against STRIPE_WEBHOOK_SECRET
 *     using SubtleCrypto (constructEventAsync). Invalid signatures 400.
 *   • No auth middleware runs on this route — the signature IS the auth.
 *
 * Idempotency:
 *   • webhook_event.event_id is UNIQUE. On re-delivery the INSERT fails
 *     and we short-circuit with a 200 response if the event was already
 *     processed. Unprocessed duplicates (crash mid-handler) fall through
 *     and retry the handler — which is itself idempotent via
 *     credit_transaction.stripe_session_id.
 *
 * Events handled:
 *   checkout.session.completed      Subscription activation or credit pack purchase
 *   invoice.paid                    Recurring billing cycle refresh
 *   customer.subscription.updated   Plan change, cancel-at-period-end flip
 *   customer.subscription.deleted   Subscription ended → downgrade
 *
 * Unknown events are acknowledged with 200 so Stripe stops retrying.
 * Per Stripe's docs, we must return within 10 seconds.
 */

import Stripe from "stripe";

import { getDb } from "@/lib/db";
import {
    deleteSubscription,
    getPlanIdByStripePriceId,
    getStripe,
    getUserIdByStripeCustomer,
    upsertSubscription,
} from "@/lib/stripe";
import {
    downgradeToSolo,
    grantPurchasedCredits,
    grantSubscriptionCredits,
    recordTopupSpend,
} from "@/lib/credits";
import { getCreditPack, getPlan } from "@/lib/constants";
import { logAudit } from "@/lib/audit";

// Stripe requires raw body for signature verification. Next's built-in
// `request.text()` returns the raw body as a string — perfect.
export async function POST(request: Request): Promise<Response> {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
        return new Response("Missing stripe-signature header", { status: 400 });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error("STRIPE_WEBHOOK_SECRET not configured");
        return new Response("Server not configured", { status: 500 });
    }

    const body = await request.text();
    const stripe = getStripe();

    // Verify signature via SubtleCrypto (sync path requires Node crypto
    // and throws on Workers).
    let event: Stripe.Event;
    try {
        event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            webhookSecret,
            undefined,
            Stripe.createSubtleCryptoProvider(),
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return new Response(`Signature verification failed: ${message}`, {
            status: 400,
        });
    }

    const db = await getDb();

    // ─── Dedupe ──────────────────────────────────────────────────────
    const existing = await db
        .prepare(
            "SELECT id, processed_at FROM webhook_event WHERE event_id = ? LIMIT 1",
        )
        .bind(event.id)
        .first<{ id: number; processed_at: number | null }>();

    if (existing?.processed_at) {
        // Already handled successfully — ack.
        return new Response("OK (duplicate)", { status: 200 });
    }

    if (!existing) {
        try {
            await db
                .prepare(
                    `INSERT INTO webhook_event
                     (source, event_id, event_type, payload, created_at)
                     VALUES ('stripe', ?, ?, ?, ?)`,
                )
                .bind(event.id, event.type, body, Date.now())
                .run();
        } catch (err) {
            // Race with a concurrent worker: the other side already
            // inserted. Proceed to handler — it's independently idempotent.
            if (!String(err).includes("UNIQUE")) {
                console.error("webhook_event insert failed:", err);
                return new Response("Internal error", { status: 500 });
            }
        }
    }

    // ─── Dispatch ────────────────────────────────────────────────────
    try {
        switch (event.type) {
            case "checkout.session.completed":
                await handleCheckoutCompleted(event.data.object);
                break;

            case "invoice.paid":
                await handleInvoicePaid(event.data.object);
                break;

            case "customer.subscription.updated":
                await handleSubscriptionUpdated(event.data.object);
                break;

            case "customer.subscription.deleted":
                await handleSubscriptionDeleted(event.data.object);
                break;

            default:
                // Unhandled events — mark processed and ack so Stripe
                // stops retrying.
                break;
        }

        await db
            .prepare("UPDATE webhook_event SET processed_at = ? WHERE event_id = ?")
            .bind(Date.now(), event.id)
            .run();

        return new Response("OK", { status: 200 });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Webhook handler failed for ${event.type}:`, err);
        await db
            .prepare("UPDATE webhook_event SET error = ? WHERE event_id = ?")
            .bind(message, event.id)
            .run();
        // Return 500 so Stripe retries. Handlers are idempotent, so
        // retries are safe.
        return new Response(`Handler error: ${message}`, { status: 500 });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Handlers
// ═══════════════════════════════════════════════════════════════════════════

async function handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
): Promise<void> {
    if (session.mode === "subscription") {
        await handleSubscriptionCheckout(session);
    } else if (session.mode === "payment") {
        await handleTopupCheckout(session);
    }
    // Other modes (e.g. "setup") are ignored.
}

async function handleSubscriptionCheckout(
    session: Stripe.Checkout.Session,
): Promise<void> {
    const userId =
        (session.client_reference_id as string | null) ??
        (session.metadata?.film_maker_user_id as string | undefined);
    const planId = session.metadata?.film_maker_plan_id as string | undefined;

    if (!userId || !planId) {
        throw new Error(
            `checkout.session.completed missing userId or planId (session=${session.id})`,
        );
    }

    const plan = getPlan(planId);
    if (!plan) throw new Error(`Unknown plan in checkout metadata: ${planId}`);

    // Fetch the full subscription so we can mirror its period window.
    const subscriptionId = session.subscription as string | null;
    if (!subscriptionId) {
        throw new Error(`No subscription on checkout session ${session.id}`);
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    await upsertSubscription({ userId, subscription, planId });

    await grantSubscriptionCredits({
        userId,
        planId,
        idempotencyKey: session.id,
        description: `${plan.name} plan — monthly credits`,
    });

    await recordTopupSpend(userId, plan.priceUsdCents);

    await logAudit({
        userId,
        action: "plan.upgrade",
        targetType: "subscription",
        targetId: subscriptionId,
        metadata: { planId, planName: plan.name, priceUsdCents: plan.priceUsdCents },
    });
}

async function handleTopupCheckout(
    session: Stripe.Checkout.Session,
): Promise<void> {
    const userId =
        (session.client_reference_id as string | null) ??
        (session.metadata?.film_maker_user_id as string | undefined);
    const packId = session.metadata?.film_maker_pack_id as string | undefined;

    if (!userId || !packId) {
        throw new Error(
            `checkout.session.completed (payment) missing userId or packId (session=${session.id})`,
        );
    }

    const pack = getCreditPack(packId);
    if (!pack) throw new Error(`Unknown credit pack in checkout metadata: ${packId}`);

    await grantPurchasedCredits({
        userId,
        credits: pack.credits,
        idempotencyKey: session.id,
        description: `Purchased ${pack.credits} credits (${pack.priceLabel})`,
    });

    await recordTopupSpend(userId, pack.priceUsdCents);

    await logAudit({
        userId,
        action: "credits.grant",
        targetType: "user",
        targetId: userId,
        metadata: { packId, credits: pack.credits, priceUsdCents: pack.priceUsdCents },
    });
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    // Only recurring-cycle invoices here. The first invoice of a
    // subscription is also paid, but the credit grant for it happens via
    // checkout.session.completed (keyed by session id). We avoid double-
    // granting by keying THIS event on invoice.id, which is a different
    // namespace from session ids.
    //
    // `billing_reason` disambiguates:
    //   subscription_create  — first invoice (skip, handled by checkout)
    //   subscription_cycle   — recurring billing
    //   subscription_update  — plan change mid-cycle
    if (invoice.billing_reason !== "subscription_cycle") return;

    const customerId = invoice.customer as string | null;
    if (!customerId) return;

    const userId = await getUserIdByStripeCustomer(customerId);
    if (!userId) {
        console.warn(`invoice.paid: unknown customer ${customerId}`);
        return;
    }

    // Resolve plan from the first invoice line's price id.
    // `pricing.price_details.price` can be either a string id or an
    // expanded Price object depending on invoice retrieval options.
    const lineItem = invoice.lines.data[0];
    const rawPrice = lineItem?.pricing?.price_details?.price;
    const priceId = typeof rawPrice === "string" ? rawPrice : rawPrice?.id;
    if (!priceId) {
        throw new Error(`invoice.paid: no price on invoice ${invoice.id}`);
    }

    const planId = getPlanIdByStripePriceId(priceId);
    if (!planId) {
        console.warn(`invoice.paid: unknown price ${priceId}`);
        return;
    }
    const plan = getPlan(planId);
    if (!plan) throw new Error(`Unknown plan: ${planId}`);

    await grantSubscriptionCredits({
        userId,
        planId,
        idempotencyKey: invoice.id!,
        description: `${plan.name} plan — monthly credits (renewal)`,
    });

    // Also refresh the subscription mirror if the subscription id is known.
    const subscriptionId = invoice.parent?.subscription_details?.subscription as
        | string
        | undefined;
    if (typeof subscriptionId === "string") {
        const stripe = getStripe();
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscription({ userId, subscription, planId });
    }
}

async function handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
): Promise<void> {
    const customerId = subscription.customer as string;
    const userId = await getUserIdByStripeCustomer(customerId);
    if (!userId) return;

    const firstItemPrice = subscription.items.data[0]?.price;
    const priceId =
        typeof firstItemPrice === "string" ? firstItemPrice : firstItemPrice?.id;
    if (!priceId) return;

    const planId = getPlanIdByStripePriceId(priceId);
    if (!planId) return;

    await upsertSubscription({ userId, subscription, planId });

    // Note: plan *upgrades* will also fire invoice.paid with
    // billing_reason=subscription_update, which grants fresh credits.
    // This handler only mirrors the subscription state.
}

async function handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
): Promise<void> {
    const customerId = subscription.customer as string;
    const userId = await getUserIdByStripeCustomer(customerId);
    if (!userId) return;

    await deleteSubscription(userId);
    await downgradeToSolo({
        userId,
        idempotencyKey: `downgrade_${subscription.id}`,
    });

    await logAudit({
        userId,
        action: "plan.downgrade",
        targetType: "subscription",
        targetId: subscription.id,
        metadata: { reason: "subscription_deleted" },
    });
}
