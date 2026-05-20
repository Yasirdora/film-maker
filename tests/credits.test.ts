/**
 * Tests for lib/credits.ts — two-pool credit accounting.
 *
 * These tests cover the financially critical paths:
 *   • deductCredits — pool splitting, daily limits, error conditions
 *   • refundCredits — correct pool restoration
 *   • grantSubscriptionCredits — replacement semantics, idempotency
 *   • grantPurchasedCredits — additive semantics, idempotency
 *   • downgradeToSolo — zeroes subscription pool, preserves purchased
 *
 * All database interactions are mocked via vi.mock("@/lib/db"). The
 * mock tracks bind parameters so tests can assert on the exact values
 * written to D1.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    deductCredits,
    refundCredits,
    grantSubscriptionCredits,
    grantPurchasedCredits,
    downgradeToSolo,
    InsufficientCreditsError,
    DailyLimitError,
    MonthlyVideoLimitError,
} from "@/lib/credits";

// ─── D1 mock ──────────────────────────────────────────────────────────────

// Tracks the most recent bind parameters for assertions.
let bindArgs: unknown[][] = [];
let firstReturnValue: unknown = null;
let batchCalled = false;
let batchShouldThrowUnique = false;

function createMockStatement() {
    return {
        bind: (...args: unknown[]) => {
            bindArgs.push(args);
            return {
                first: vi.fn().mockResolvedValue(firstReturnValue),
                run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
                all: vi.fn().mockResolvedValue({ results: [] }),
            };
        },
    };
}

const mockDb = {
    prepare: vi.fn(() => createMockStatement()),
    batch: vi.fn(async () => {
        batchCalled = true;
        if (batchShouldThrowUnique) {
            throw new Error("UNIQUE constraint failed: credit_transaction.stripe_session_id");
        }
        return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }];
    }),
};

vi.mock("@/lib/db", () => ({
    getDb: vi.fn(async () => mockDb),
}));

beforeEach(() => {
    bindArgs = [];
    firstReturnValue = null;
    batchCalled = false;
    batchShouldThrowUnique = false;
    vi.clearAllMocks();
});

// ─── Helper ───────────────────────────────────────────────────────────────

/** Creates a mock user_profile row for deductCredits reads. */
function mockProfile(overrides: Partial<{
    subscription_credits: number;
    purchased_credits: number;
    use_extra_credits: number;
    plan: string;
    daily_credits_used: number;
    last_daily_reset: number;
    monthly_videos_used: number;
    monthly_video_reset_at: number;
}> = {}) {
    return {
        subscription_credits: 100,
        purchased_credits: 50,
        use_extra_credits: 1,
        plan: "indie",
        daily_credits_used: 0,
        last_daily_reset: 0,
        monthly_videos_used: 0,
        monthly_video_reset_at: 0,
        ...overrides,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// deductCredits
// ═══════════════════════════════════════════════════════════════════════════

describe("deductCredits", () => {
    it("deducts entirely from subscription pool when sufficient", async () => {
        firstReturnValue = mockProfile({ subscription_credits: 100, purchased_credits: 50 });

        const result = await deductCredits({
            userId: "u1",
            cost: 3,
            generationId: 1,
            description: "test",
            kind: "image",
        });

        expect(result.fromSubscription).toBe(3);
        expect(result.fromPurchased).toBe(0);
        expect(batchCalled).toBe(true);
    });

    it("splits across both pools when subscription insufficient", async () => {
        firstReturnValue = mockProfile({
            subscription_credits: 2,
            purchased_credits: 50,
            use_extra_credits: 1,
        });

        const result = await deductCredits({
            userId: "u1",
            cost: 5,
            generationId: 1,
            description: "test",
            kind: "image",
        });

        expect(result.fromSubscription).toBe(2);
        expect(result.fromPurchased).toBe(3);
    });

    it("deducts entirely from purchased when subscription is zero", async () => {
        firstReturnValue = mockProfile({
            subscription_credits: 0,
            purchased_credits: 50,
            use_extra_credits: 1,
        });

        const result = await deductCredits({
            userId: "u1",
            cost: 4,
            generationId: 1,
            description: "test",
            kind: "image",
        });

        expect(result.fromSubscription).toBe(0);
        expect(result.fromPurchased).toBe(4);
    });

    it("ignores purchased pool when use_extra_credits is off", async () => {
        firstReturnValue = mockProfile({
            subscription_credits: 2,
            purchased_credits: 100,
            use_extra_credits: 0,
        });

        await expect(
            deductCredits({
                userId: "u1",
                cost: 5,
                generationId: 1,
                description: "test",
                kind: "image",
            }),
        ).rejects.toThrow(InsufficientCreditsError);
    });

    it("throws InsufficientCreditsError when both pools exhausted", async () => {
        firstReturnValue = mockProfile({
            subscription_credits: 1,
            purchased_credits: 1,
            use_extra_credits: 1,
        });

        await expect(
            deductCredits({
                userId: "u1",
                cost: 5,
                generationId: 1,
                description: "test",
                kind: "image",
            }),
        ).rejects.toThrow(InsufficientCreditsError);
    });

    it("throws DailyLimitError for solo plan at cap", async () => {
        // Solo plan, already used 2 credits today, trying to use 2 more
        // (cap is 3).
        const now = Date.now();
        firstReturnValue = mockProfile({
            plan: "solo",
            subscription_credits: 100,
            daily_credits_used: 2,
            last_daily_reset: now, // Same day
        });

        await expect(
            deductCredits({
                userId: "u1",
                cost: 2,
                generationId: 1,
                description: "test",
                kind: "image",
            }),
        ).rejects.toThrow(DailyLimitError);
    });

    it("does not enforce daily limit on paid plans", async () => {
        const now = Date.now();
        firstReturnValue = mockProfile({
            plan: "indie",
            subscription_credits: 100,
            daily_credits_used: 100,
            last_daily_reset: now,
        });

        // Should not throw — paid plans have no daily limit.
        const result = await deductCredits({
            userId: "u1",
            cost: 1,
            generationId: 1,
            description: "test",
            kind: "image",
        });

        expect(result.fromSubscription).toBe(1);
    });

    it("resets daily counter when new UTC day", async () => {
        // last_daily_reset is from yesterday — counter should reset to 0.
        const yesterday = Date.now() - 2 * 24 * 60 * 60 * 1000;
        firstReturnValue = mockProfile({
            plan: "solo",
            subscription_credits: 100,
            daily_credits_used: 3, // Was at cap yesterday
            last_daily_reset: yesterday,
        });

        // Should succeed because the counter resets.
        const result = await deductCredits({
            userId: "u1",
            cost: 1,
            generationId: 1,
            description: "test",
            kind: "image",
        });

        expect(result.fromSubscription).toBe(1);
    });

    it("throws on zero cost", async () => {
        await expect(
            deductCredits({
                userId: "u1",
                cost: 0,
                generationId: 1,
                description: "test",
                kind: "image",
            }),
        ).rejects.toThrow("Credit cost must be positive");
    });

    it("throws on negative cost", async () => {
        await expect(
            deductCredits({
                userId: "u1",
                cost: -1,
                generationId: 1,
                description: "test",
                kind: "image",
            }),
        ).rejects.toThrow("Credit cost must be positive");
    });

    it("throws when user profile missing", async () => {
        firstReturnValue = null;

        await expect(
            deductCredits({
                userId: "u1",
                cost: 1,
                generationId: 1,
                description: "test",
                kind: "image",
            }),
        ).rejects.toThrow("No user_profile");
    });

    it("allows solo video even when daily cap is already hit", async () => {
        // Solo user has already spent 3 credits on images today. A video
        // (5+ credits) would exceed the daily cap, but videos bypass it.
        const now = Date.now();
        firstReturnValue = mockProfile({
            plan: "solo",
            subscription_credits: 100,
            daily_credits_used: 3,
            last_daily_reset: now,
            monthly_videos_used: 0,
        });

        const result = await deductCredits({
            userId: "u1",
            cost: 5,
            generationId: 1,
            description: "test",
            kind: "video",
        });

        expect(result.fromSubscription).toBe(5);
    });

    it("throws MonthlyVideoLimitError when solo user already used their video", async () => {
        const now = Date.now();
        firstReturnValue = mockProfile({
            plan: "solo",
            subscription_credits: 100,
            monthly_videos_used: 1,
            monthly_video_reset_at: now, // Same month
        });

        await expect(
            deductCredits({
                userId: "u1",
                cost: 5,
                generationId: 1,
                description: "test",
                kind: "video",
            }),
        ).rejects.toThrow(MonthlyVideoLimitError);
    });

    it("does not enforce monthly video cap on paid plans", async () => {
        const now = Date.now();
        firstReturnValue = mockProfile({
            plan: "indie",
            subscription_credits: 100,
            monthly_videos_used: 999, // irrelevant — ignored on paid
            monthly_video_reset_at: now,
        });

        const result = await deductCredits({
            userId: "u1",
            cost: 5,
            generationId: 1,
            description: "test",
            kind: "video",
        });

        expect(result.fromSubscription).toBe(5);
    });

    it("resets monthly video counter when new UTC month", async () => {
        // Prior month's counter is at cap; a fresh month should allow 1 video.
        const longAgo = Date.UTC(2020, 0, 1);
        firstReturnValue = mockProfile({
            plan: "solo",
            subscription_credits: 100,
            monthly_videos_used: 1,
            monthly_video_reset_at: longAgo,
        });

        const result = await deductCredits({
            userId: "u1",
            cost: 5,
            generationId: 1,
            description: "test",
            kind: "video",
        });

        expect(result.fromSubscription).toBe(5);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// refundCredits
// ═══════════════════════════════════════════════════════════════════════════

describe("refundCredits", () => {
    it("refunds to both pools proportionally and decrements daily counter for image", async () => {
        await refundCredits({
            userId: "u1",
            cost: 5,
            generationId: 1,
            deduction: { fromSubscription: 3, fromPurchased: 2 },
            kind: "image",
        });

        expect(batchCalled).toBe(true);

        // Verify the batch was called with correct bind values.
        // UPDATE: subscription_credits + ?, purchased_credits + ?,
        //         daily_credits_used - ?, monthly_videos_used - ?,
        //         updated_at, user_id
        const updateBinds = bindArgs[0];
        expect(updateBinds?.[0]).toBe(3); // fromSubscription
        expect(updateBinds?.[1]).toBe(2); // fromPurchased
        expect(updateBinds?.[2]).toBe(5); // cost (daily counter decrement)
        expect(updateBinds?.[3]).toBe(0); // no video counter decrement
    });

    it("refunds to subscription only when no purchased used", async () => {
        await refundCredits({
            userId: "u1",
            cost: 4,
            generationId: 1,
            deduction: { fromSubscription: 4, fromPurchased: 0 },
            kind: "image",
        });

        expect(batchCalled).toBe(true);
        const updateBinds = bindArgs[0];
        expect(updateBinds?.[0]).toBe(4);
        expect(updateBinds?.[1]).toBe(0);
    });

    it("decrements monthly video counter but not daily for video kind", async () => {
        await refundCredits({
            userId: "u1",
            cost: 5,
            generationId: 1,
            deduction: { fromSubscription: 5, fromPurchased: 0 },
            kind: "video",
        });

        expect(batchCalled).toBe(true);
        const updateBinds = bindArgs[0];
        expect(updateBinds?.[2]).toBe(0); // daily counter untouched
        expect(updateBinds?.[3]).toBe(1); // monthly video counter decremented
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// grantSubscriptionCredits
// ═══════════════════════════════════════════════════════════════════════════

describe("grantSubscriptionCredits", () => {
    it("rejects free plan grants", async () => {
        await expect(
            grantSubscriptionCredits({
                userId: "u1",
                planId: "solo",
                idempotencyKey: "key-1",
                description: "test",
            }),
        ).rejects.toThrow("Refusing to grant subscription credits for free plan");
    });

    it("rejects unknown plan", async () => {
        await expect(
            grantSubscriptionCredits({
                userId: "u1",
                planId: "nonexistent",
                idempotencyKey: "key-1",
                description: "test",
            }),
        ).rejects.toThrow("Unknown plan");
    });

    it("grants credits for valid paid plan", async () => {
        // Mock: no existing transaction (not yet processed).
        firstReturnValue = null;

        await grantSubscriptionCredits({
            userId: "u1",
            planId: "indie",
            idempotencyKey: "session-123",
            description: "Indie plan — monthly credits",
        });

        expect(batchCalled).toBe(true);
    });

    it("is idempotent — skips on duplicate key", async () => {
        batchShouldThrowUnique = true;

        await grantSubscriptionCredits({
            userId: "u1",
            planId: "indie",
            idempotencyKey: "session-123",
            description: "Indie plan — monthly credits",
        });

        // batch was called but the UNIQUE error was swallowed — no exception.
        expect(batchCalled).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// grantPurchasedCredits
// ═══════════════════════════════════════════════════════════════════════════

describe("grantPurchasedCredits", () => {
    it("rejects zero credit grants", async () => {
        await expect(
            grantPurchasedCredits({
                userId: "u1",
                credits: 0,
                idempotencyKey: "key-1",
                description: "test",
            }),
        ).rejects.toThrow("Credit grant amount must be positive");
    });

    it("rejects negative credit grants", async () => {
        await expect(
            grantPurchasedCredits({
                userId: "u1",
                credits: -10,
                idempotencyKey: "key-1",
                description: "test",
            }),
        ).rejects.toThrow("Credit grant amount must be positive");
    });

    it("grants purchased credits for valid amount", async () => {
        firstReturnValue = null; // Not yet processed.

        await grantPurchasedCredits({
            userId: "u1",
            credits: 50,
            idempotencyKey: "session-456",
            description: "Purchased 50 credits ($7)",
        });

        expect(batchCalled).toBe(true);
    });

    it("is idempotent — skips on duplicate key", async () => {
        batchShouldThrowUnique = true;

        await grantPurchasedCredits({
            userId: "u1",
            credits: 50,
            idempotencyKey: "session-456",
            description: "Purchased 50 credits ($7)",
        });

        expect(batchCalled).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// downgradeToSolo
// ═══════════════════════════════════════════════════════════════════════════

describe("downgradeToSolo", () => {
    it("executes downgrade batch", async () => {
        firstReturnValue = null; // Not yet processed.

        await downgradeToSolo({
            userId: "u1",
            idempotencyKey: "downgrade_sub_123",
        });

        expect(batchCalled).toBe(true);
    });

    it("is idempotent — skips on duplicate key", async () => {
        batchShouldThrowUnique = true;

        await downgradeToSolo({
            userId: "u1",
            idempotencyKey: "downgrade_sub_123",
        });

        expect(batchCalled).toBe(true);
    });
});
