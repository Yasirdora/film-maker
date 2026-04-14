/**
 * Film-maker — canonical application constants.
 *
 * Single source of truth for subscription plans, photo models, credit cost
 * calculation, and shared URLs. Imported by both client (pricing page,
 * generator form) and server (Stripe checkout, credit deduction, validation).
 *
 * Changing anything in this file affects billing behavior, so treat edits
 * with the same care as a database migration.
 */

// ─── Free tier daily cap ────────────────────────────────────────────────────
// Solo users can spend at most this many credits per day. Paid plans have
// no daily cap. Counter resets at UTC midnight via atomic UPDATE on the
// user_profile row.
export const SOLO_DAILY_CREDIT_LIMIT = 3;

// ─── Monthly top-up USD spend ceiling ───────────────────────────────────────
// Hard cap on how much USD a user can spend on credit top-ups per calendar
// month. Raisable on request. Prevents runaway charges from compromised
// accounts / stolen cards. Stored in cents.
export const MONTHLY_TOPUP_USD_CENTS_CEILING = 50_000; // $500

// ─── Session ────────────────────────────────────────────────────────────────
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

// ─── Rate limits (unauthenticated endpoints) ────────────────────────────────
export const MAGIC_LINK_PER_EMAIL_PER_HOUR = 5;
export const MAGIC_LINK_PER_IP_PER_HOUR = 10;
export const SIGNUP_PER_IP_PER_HOUR = 10;

// ─── R2 storage ─────────────────────────────────────────────────────────────
// Public URL base for objects in the `storage.film-maker.net` R2 bucket.
export const R2_STORAGE_BASE_URL = "https://storage.film-maker.net";

// ─── Gemini API ─────────────────────────────────────────────────────────────
// We use the Gemini API directly for v0. In v1 this moves to Vertex AI for
// higher quotas.
export const GEMINI_BASE_URL =
    "https://generativelanguage.googleapis.com/v1beta/models";

// ═══════════════════════════════════════════════════════════════════════════
// Subscription plans
// ═══════════════════════════════════════════════════════════════════════════
// Shared between the pricing page, Stripe checkout, webhook fulfillment,
// and the credit-grant logic. Plans are ordered from free → enterprise.
//
// Pricing is in USD (cents). Stripe Tax handles per-country VAT/GST at
// checkout, so we quote a single USD price everywhere.
//
// v0 is image-only. Features like "4K export", "scene generation", "priority
// queue" are kept on higher tiers as upgrade hooks for v1 when video lands.
// ═══════════════════════════════════════════════════════════════════════════

export const SUBSCRIPTION_PLANS = [
    {
        id: "solo",
        name: "Solo",
        credits: 100,
        dailyLimit: SOLO_DAILY_CREDIT_LIMIT,
        priceUsdCents: 0,
        priceLabel: "Free",
        interval: null,
        description:
            "Try Film-maker. Perfect for students, hobbyists, and anyone exploring their visual ideas.",
        features: [
            "100 credits / month",
            `${SOLO_DAILY_CREDIT_LIMIT} credits / day`,
            "1K resolution",
            "Personal use",
        ],
        maxResolution: "1K",
        isFree: true,
    },
    {
        id: "indie",
        name: "Indie",
        credits: 200,
        dailyLimit: null,
        priceUsdCents: 2000,
        priceLabel: "$20",
        interval: "month" as const,
        description:
            "For solo creators ready to build a body of work. No daily limits.",
        features: [
            "200 credits / month",
            "Up to 2K resolution",
            "Unlimited daily generations",
            "Commercial license",
        ],
        maxResolution: "2K",
        isFree: false,
    },
    {
        id: "creator",
        name: "Creator",
        credits: 500,
        dailyLimit: null,
        priceUsdCents: 5000,
        priceLabel: "$50",
        interval: "month" as const,
        description:
            "Full production power — 4K renders and priority queue. Most popular.",
        features: [
            "500 credits / month",
            "Up to 4K resolution",
            "Priority queue",
            "Everything in Indie",
        ],
        maxResolution: "4K",
        isFree: false,
        featured: true,
    },
    {
        id: "studio",
        name: "Studio",
        credits: 2000,
        dailyLimit: null,
        priceUsdCents: 20_000,
        priceLabel: "$200",
        interval: "month" as const,
        description:
            "High-volume production. Dedicated support and priority access to new models.",
        features: [
            "2,000 credits / month",
            "Up to 4K resolution",
            "Priority queue",
            "Dedicated support",
        ],
        maxResolution: "4K",
        isFree: false,
    },
] as const;

export type SubscriptionPlanId = (typeof SUBSCRIPTION_PLANS)[number]["id"];
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

/** Returns the plan definition for the given id, or undefined. */
export function getPlan(id: string): SubscriptionPlan | undefined {
    return SUBSCRIPTION_PLANS.find((p) => p.id === id);
}

/** Returns true if the given plan id is the free (solo) tier. */
export function isFreePlan(id: string): boolean {
    return id === "solo";
}

// ═══════════════════════════════════════════════════════════════════════════
// Credit packs (one-time purchases)
// ═══════════════════════════════════════════════════════════════════════════
// Top-up packs add to the `purchased_credits` pool, which is permanent
// (never expires or resets). Priced at a modest premium over subscription
// per-credit rates to incentivize subscriptions for heavy users.
//
// The monthly spend ceiling (MONTHLY_TOPUP_USD_CENTS_CEILING) caps how
// much a user can purchase per calendar month — enforced at checkout time.
// ═══════════════════════════════════════════════════════════════════════════

export const CREDIT_PACKS = [
    {
        id: "small",
        credits: 50,
        priceUsdCents: 700,
        priceLabel: "$7",
        description: "50 credits — try a few ideas",
    },
    {
        id: "medium",
        credits: 200,
        priceUsdCents: 2500,
        priceLabel: "$25",
        description: "200 credits — extended session",
    },
    {
        id: "large",
        credits: 500,
        priceUsdCents: 5500,
        priceLabel: "$55",
        description: "500 credits — best value",
    },
] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];
export type CreditPack = (typeof CREDIT_PACKS)[number];

export function getCreditPack(id: string): CreditPack | undefined {
    return CREDIT_PACKS.find((p) => p.id === id);
}

// ═══════════════════════════════════════════════════════════════════════════
// Photo generation models (v0: image only)
// ═══════════════════════════════════════════════════════════════════════════

export const PHOTO_MODELS = [
    {
        id: "nano-banana-pro",
        name: "Nano Banana Pro",
        description: "Google's flagship image model. Best for cinematic stills.",
        // Resolved model: imagen-4.0-generate-001 via the generateImages API.
        // The user-facing name "Nano Banana Pro" is stable; swapping the
        // underlying model requires only changing this field.
        geminiModelId: "imagen-4.0-generate-001",
        creditBase: 1,
    },
] as const;

export type PhotoModelId = (typeof PHOTO_MODELS)[number]["id"];
export type PhotoModel = (typeof PHOTO_MODELS)[number];

export function getPhotoModel(id: string): PhotoModel | undefined {
    return PHOTO_MODELS.find((m) => m.id === id);
}

// ═══════════════════════════════════════════════════════════════════════════
// Resolutions
// ═══════════════════════════════════════════════════════════════════════════

export const RESOLUTIONS = ["1K", "2K", "4K"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

/**
 * Credit cost multiplier per resolution. Ported from ConveX's photo credit
 * pricing model. A 4K image costs 4× a 1K image.
 */
export const RESOLUTION_MULTIPLIERS: Record<Resolution, number> = {
    "1K": 1,
    "2K": 2,
    "4K": 4,
};

/**
 * Computes the credit cost for a photo generation.
 *
 * cost = model.creditBase × resolutionMultiplier × sampleCount
 *
 * Always called server-side before debiting credits — the client's
 * preview value is never trusted.
 */
export function computePhotoCreditCost(
    modelId: string,
    resolution: Resolution,
    sampleCount: number,
): number {
    const model = getPhotoModel(modelId);
    if (!model) {
        throw new Error(
            `Unknown model "${modelId}". Cannot compute credit cost ` +
            `for an unrecognized model — this would allow zero-cost ` +
            `generations that consume API resources without deducting credits.`,
        );
    }
    const resMult = RESOLUTION_MULTIPLIERS[resolution] ?? 1;
    return model.creditBase * resMult * Math.max(1, sampleCount);
}

/**
 * Returns true if the given plan is allowed to generate at the given
 * resolution. Free plan is capped at 1K; paid plans up to their
 * `maxResolution`.
 */
export function isResolutionAllowedForPlan(
    planId: string,
    resolution: Resolution,
): boolean {
    const plan = getPlan(planId);
    if (!plan) return false;
    const maxIdx = RESOLUTIONS.indexOf(plan.maxResolution);
    const reqIdx = RESOLUTIONS.indexOf(resolution);
    return reqIdx !== -1 && maxIdx !== -1 && reqIdx <= maxIdx;
}
