/**
 * Tests for lib/constants.ts — credit cost computation, plan resolution
 * gating, and plan lookup. These are the billing-critical pure functions
 * where a bug directly impacts revenue or user trust.
 */

import { describe, it, expect } from "vitest";
import {
    computePhotoCreditCost,
    isResolutionAllowedForPlan,
    getPlan,
    getPhotoModel,
    isFreePlan,
    SUBSCRIPTION_PLANS,
    PHOTO_MODELS,
    RESOLUTIONS,
    RESOLUTION_MULTIPLIERS,
} from "@/lib/constants";

// ─── computePhotoCreditCost ────────────────────────────────────────────────

describe("computePhotoCreditCost", () => {
    it("computes base cost for 1K resolution", () => {
        expect(computePhotoCreditCost("nano-banana-pro", "1K", 1)).toBe(1);
    });

    it("applies 2x multiplier for 2K resolution", () => {
        expect(computePhotoCreditCost("nano-banana-pro", "2K", 1)).toBe(2);
    });

    it("applies 4x multiplier for 4K resolution", () => {
        expect(computePhotoCreditCost("nano-banana-pro", "4K", 1)).toBe(4);
    });

    it("multiplies by sample count", () => {
        expect(computePhotoCreditCost("nano-banana-pro", "2K", 3)).toBe(6);
    });

    it("enforces minimum sample count of 1", () => {
        expect(computePhotoCreditCost("nano-banana-pro", "1K", 0)).toBe(1);
        expect(computePhotoCreditCost("nano-banana-pro", "1K", -5)).toBe(1);
    });

    it("throws on unknown model", () => {
        expect(() => computePhotoCreditCost("nonexistent-model", "1K", 1)).toThrow(
            "Unknown model",
        );
    });
});

// ─── isResolutionAllowedForPlan ────────────────────────────────────────────

describe("isResolutionAllowedForPlan", () => {
    it("solo plan allows only 1K", () => {
        expect(isResolutionAllowedForPlan("solo", "1K")).toBe(true);
        expect(isResolutionAllowedForPlan("solo", "2K")).toBe(false);
        expect(isResolutionAllowedForPlan("solo", "4K")).toBe(false);
    });

    it("indie plan allows up to 2K", () => {
        expect(isResolutionAllowedForPlan("indie", "1K")).toBe(true);
        expect(isResolutionAllowedForPlan("indie", "2K")).toBe(true);
        expect(isResolutionAllowedForPlan("indie", "4K")).toBe(false);
    });

    it("creator plan allows up to 4K", () => {
        expect(isResolutionAllowedForPlan("creator", "1K")).toBe(true);
        expect(isResolutionAllowedForPlan("creator", "2K")).toBe(true);
        expect(isResolutionAllowedForPlan("creator", "4K")).toBe(true);
    });

    it("studio plan allows up to 4K", () => {
        expect(isResolutionAllowedForPlan("studio", "4K")).toBe(true);
    });

    it("rejects unknown plan", () => {
        expect(isResolutionAllowedForPlan("nonexistent", "1K")).toBe(false);
    });
});

// ─── Plan lookup ───────────────────────────────────────────────────────────

describe("getPlan", () => {
    it("returns plan by id", () => {
        const plan = getPlan("creator");
        expect(plan).toBeDefined();
        expect(plan!.name).toBe("Creator");
        expect(plan!.credits).toBe(500);
        expect(plan!.priceUsdCents).toBe(5000);
    });

    it("returns undefined for unknown plan", () => {
        expect(getPlan("nonexistent")).toBeUndefined();
    });
});

describe("isFreePlan", () => {
    it("solo is free", () => {
        expect(isFreePlan("solo")).toBe(true);
    });

    it("paid plans are not free", () => {
        expect(isFreePlan("indie")).toBe(false);
        expect(isFreePlan("creator")).toBe(false);
        expect(isFreePlan("studio")).toBe(false);
    });
});

// ─── Model lookup ──────────────────────────────────────────────────────────

describe("getPhotoModel", () => {
    it("returns model by id", () => {
        const model = getPhotoModel("nano-banana-pro");
        expect(model).toBeDefined();
        expect(model!.geminiModelId).toBe("imagen-4.0-generate-001");
    });

    it("returns undefined for unknown model", () => {
        expect(getPhotoModel("nonexistent")).toBeUndefined();
    });
});

// ─── Data integrity ────────────────────────────────────────────────────────

describe("data integrity", () => {
    it("all plans have unique ids", () => {
        const ids = SUBSCRIPTION_PLANS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("all plans have valid maxResolution", () => {
        for (const plan of SUBSCRIPTION_PLANS) {
            expect(RESOLUTIONS).toContain(plan.maxResolution);
        }
    });

    it("all resolution multipliers are defined", () => {
        for (const res of RESOLUTIONS) {
            expect(RESOLUTION_MULTIPLIERS[res]).toBeGreaterThan(0);
        }
    });

    it("all models have positive creditBase", () => {
        for (const model of PHOTO_MODELS) {
            expect(model.creditBase).toBeGreaterThan(0);
        }
    });

    it("free plan exists and has the lowest credits", () => {
        const freePlans = SUBSCRIPTION_PLANS.filter((p) => p.isFree);
        expect(freePlans).toHaveLength(1);
        const freeCredits = freePlans[0].credits;
        for (const plan of SUBSCRIPTION_PLANS) {
            if (!plan.isFree) {
                expect(plan.credits).toBeGreaterThan(freeCredits);
            }
        }
    });
});
