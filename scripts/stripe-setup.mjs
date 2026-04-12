#!/usr/bin/env node
/**
 * Stripe bootstrap — idempotent.
 *
 * Creates (or finds) a Stripe Product + recurring monthly Price for each
 * paid Film-maker plan, then prints the env var lines that the runtime
 * code needs.
 *
 * Usage:
 *   npm run stripe:setup
 *
 * Behavior:
 *   • Reads STRIPE_SECRET_KEY from .dev.vars via `node --env-file=...`
 *   • For each plan (indie / creator / studio):
 *       - Searches for a Product with metadata.film_maker_plan_id matching
 *       - Creates one if missing
 *       - Searches for a matching active Price (usd, monthly, exact amount)
 *       - Creates one if missing
 *   • Prints STRIPE_PRICE_<plan>=price_... lines to stdout so the user can
 *     paste them into .dev.vars (or pipe to wrangler secret put for prod).
 *
 * Idempotent: safe to run repeatedly. Re-running prints the same price ids
 * without creating duplicates.
 *
 * Note: This script deliberately duplicates the plan definition instead of
 * importing from lib/constants.ts. The runtime is ESM-transpiled TS; this
 * script runs in plain Node. Keeping it self-contained avoids a build
 * step and a `tsx` dependency.
 */

import Stripe from "stripe";

// ─── Plan definitions (mirror of lib/constants.ts SUBSCRIPTION_PLANS) ─────
// Keep in sync when pricing changes. Tested by running the script twice
// and confirming no new prices get created.
const PAID_PLANS = [
    { id: "indie", name: "Indie", priceUsdCents: 2000 },
    { id: "creator", name: "Creator", priceUsdCents: 5000 },
    { id: "studio", name: "Studio", priceUsdCents: 20000 },
];

// ─── Main ──────────────────────────────────────────────────────────────────
const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) {
    console.error(
        "✗ STRIPE_SECRET_KEY is not set.\n" +
            "  Run:  npm run stripe:setup  (which sources .dev.vars via node --env-file)",
    );
    process.exit(1);
}

const stripe = new Stripe(apiKey);

const mode = apiKey.startsWith("sk_test_") ? "test" : "live";
console.log(`Stripe mode: ${mode}\n`);

const envLines = [];

for (const plan of PAID_PLANS) {
    // ─── Find or create the Product ────────────────────────────────────
    const existingProducts = await stripe.products.search({
        query: `metadata['film_maker_plan_id']:'${plan.id}'`,
    });

    let product;
    if (existingProducts.data.length > 0) {
        product = existingProducts.data[0];
        console.log(`✓ Product "${plan.name}" already exists: ${product.id}`);
    } else {
        product = await stripe.products.create({
            name: `Film-maker ${plan.name}`,
            description: `Film-maker ${plan.name} plan — monthly subscription`,
            metadata: { film_maker_plan_id: plan.id },
        });
        console.log(`+ Created product "${plan.name}": ${product.id}`);
    }

    // ─── Find or create the Price ─────────────────────────────────────
    const existingPrices = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 100,
    });

    let price = existingPrices.data.find(
        (p) =>
            p.currency === "usd" &&
            p.unit_amount === plan.priceUsdCents &&
            p.recurring?.interval === "month",
    );

    if (price) {
        console.log(`✓ Price for "${plan.name}" already exists: ${price.id}`);
    } else {
        price = await stripe.prices.create({
            product: product.id,
            unit_amount: plan.priceUsdCents,
            currency: "usd",
            recurring: { interval: "month" },
            metadata: { film_maker_plan_id: plan.id },
        });
        console.log(`+ Created price for "${plan.name}": ${price.id}`);
    }

    envLines.push(`STRIPE_PRICE_${plan.id.toUpperCase()}=${price.id}`);
}

console.log("\n─── Paste into .dev.vars (local) ────────────────────────");
console.log(envLines.join("\n"));
console.log("\n─── Or push to production via wrangler ──────────────────");
for (const line of envLines) {
    const [key, value] = line.split("=");
    console.log(`echo "${value}" | npx wrangler secret put ${key}`);
}
console.log();
