/**
 * Tests for lib/stripe.ts — price ID lookups and reverse resolution.
 *
 * These functions are the bridge between Stripe's price IDs (opaque
 * strings from env vars) and Film-maker's internal plan/pack IDs.
 * A bug here means charging the wrong amount or granting the wrong
 * plan's credits.
 *
 * The Stripe SDK instance and D1 database are NOT tested here —
 * those require integration tests. Only the pure lookup functions
 * that read process.env are covered.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We need to mock getDb before importing stripe.ts since it imports at module level.
vi.mock("@/lib/db", () => ({
    getDb: vi.fn(async () => ({})),
}));

import {
    getStripePriceId,
    getTopupPriceId,
    getPlanIdByStripePriceId,
    getPackIdByStripePriceId,
} from "@/lib/stripe";

// ─── Env setup ────────────────────────────────────────────────────────────

const TEST_ENV = {
    STRIPE_SECRET_KEY: "sk_test_fake",
    STRIPE_PRICE_INDIE: "price_indie_123",
    STRIPE_PRICE_CREATOR: "price_creator_456",
    STRIPE_PRICE_STUDIO: "price_studio_789",
    STRIPE_PRICE_TOPUP_SMALL: "price_topup_small_111",
    STRIPE_PRICE_TOPUP_MEDIUM: "price_topup_medium_222",
    STRIPE_PRICE_TOPUP_LARGE: "price_topup_large_333",
};

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
    originalEnv = { ...process.env };
    Object.assign(process.env, TEST_ENV);
});

afterEach(() => {
    process.env = originalEnv;
});

// ═══════════════════════════════════════════════════════════════════════════
// getStripePriceId
// ═══════════════════════════════════════════════════════════════════════════

describe("getStripePriceId", () => {
    it("returns price ID for indie plan", () => {
        expect(getStripePriceId("indie")).toBe("price_indie_123");
    });

    it("returns price ID for creator plan", () => {
        expect(getStripePriceId("creator")).toBe("price_creator_456");
    });

    it("returns price ID for studio plan", () => {
        expect(getStripePriceId("studio")).toBe("price_studio_789");
    });

    it("throws on unknown plan", () => {
        expect(() => getStripePriceId("nonexistent")).toThrow(
            "No Stripe price configured",
        );
    });

    it("throws on free plan", () => {
        expect(() => getStripePriceId("solo")).toThrow(
            "No Stripe price configured",
        );
    });

    it("throws when env var is not set", () => {
        delete process.env.STRIPE_PRICE_INDIE;
        expect(() => getStripePriceId("indie")).toThrow(
            "STRIPE_PRICE_INDIE is not set",
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// getTopupPriceId
// ═══════════════════════════════════════════════════════════════════════════

describe("getTopupPriceId", () => {
    it("returns price ID for small pack", () => {
        expect(getTopupPriceId("small")).toBe("price_topup_small_111");
    });

    it("returns price ID for medium pack", () => {
        expect(getTopupPriceId("medium")).toBe("price_topup_medium_222");
    });

    it("returns price ID for large pack", () => {
        expect(getTopupPriceId("large")).toBe("price_topup_large_333");
    });

    it("throws on unknown pack", () => {
        expect(() => getTopupPriceId("xl")).toThrow(
            "No Stripe price configured for credit pack",
        );
    });

    it("throws when env var is not set", () => {
        delete process.env.STRIPE_PRICE_TOPUP_SMALL;
        expect(() => getTopupPriceId("small")).toThrow(
            "STRIPE_PRICE_TOPUP_SMALL is not set",
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// getPlanIdByStripePriceId (reverse lookup)
// ═══════════════════════════════════════════════════════════════════════════

describe("getPlanIdByStripePriceId", () => {
    it("resolves indie price to plan ID", () => {
        expect(getPlanIdByStripePriceId("price_indie_123")).toBe("indie");
    });

    it("resolves creator price to plan ID", () => {
        expect(getPlanIdByStripePriceId("price_creator_456")).toBe("creator");
    });

    it("resolves studio price to plan ID", () => {
        expect(getPlanIdByStripePriceId("price_studio_789")).toBe("studio");
    });

    it("returns null for unknown price", () => {
        expect(getPlanIdByStripePriceId("price_unknown")).toBeNull();
    });

    it("returns null for topup price (different namespace)", () => {
        expect(getPlanIdByStripePriceId("price_topup_small_111")).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// getPackIdByStripePriceId (reverse lookup)
// ═══════════════════════════════════════════════════════════════════════════

describe("getPackIdByStripePriceId", () => {
    it("resolves small topup price to pack ID", () => {
        expect(getPackIdByStripePriceId("price_topup_small_111")).toBe("small");
    });

    it("resolves medium topup price to pack ID", () => {
        expect(getPackIdByStripePriceId("price_topup_medium_222")).toBe("medium");
    });

    it("resolves large topup price to pack ID", () => {
        expect(getPackIdByStripePriceId("price_topup_large_333")).toBe("large");
    });

    it("returns null for unknown price", () => {
        expect(getPackIdByStripePriceId("price_unknown")).toBeNull();
    });

    it("returns null for subscription price (different namespace)", () => {
        expect(getPackIdByStripePriceId("price_indie_123")).toBeNull();
    });
});
