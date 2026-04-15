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
} from "@/lib/credits";

// ─── D1 mock ──────────────────────────────────────────────────────────────

// Tracks the most recent bind parameters for assertions.
let bindArgs: unknown[][] = [];
let firstReturnValue: unknown = null;
let batchCalled = false;

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
        return [];
    }),
};

vi.mock("@/lib/db", () => ({
    getDb: vi.fn(async () => mockDb),
}));

beforeEach(() => {
    bindArgs = [];
    firstReturnValue = null;
    batchCalled = false;
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
}> = {}) {
    return {
        subscription_credits: 100,
        purchased_credits: 50,
        use_extra_credits: 1,
        plan: "indie",
        daily_credits_used: 0,
        last_daily_reset: 0,
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
            }),
        ).rejects.toThrow("No user_profile");
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// refundCredits
// ═══════════════════════════════════════════════════════════════════════════

describe("refundCredits", () => {
    it("refunds to both pools proportionally", async () => {
        await refundCredits({
            userId: "u1",
            cost: 5,
            generationId: 1,
            deduction: { fromSubscription: 3, fromPurchased: 2 },
        });

        expect(batchCalled).toBe(true);

        // Verify the batch was called with correct bind values.
        // First statement: UPDATE user_profile SET subscription_credits + ?, purchased_credits + ?
        // The bind args for the UPDATE should include 3 and 2.
        const updateBinds = bindArgs[0];
        expect(updateBinds?.[0]).toBe(3); // fromSubscription
        expect(updateBinds?.[1]).toBe(2); // fromPurchased
    });

    it("refunds to subscription only when no purchased used", async () => {
        await refundCredits({
            userId: "u1",
            cost: 4,
            generationId: 1,
            deduction: { fromSubscription: 4, fromPurchased: 0 },
        });

        expect(batchCalled).toBe(true);
        const updateBinds = bindArgs[0];
        expect(updateBinds?.[0]).toBe(4);
        expect(updateBinds?.[1]).toBe(0);
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
        // Mock: existing transaction found (already processed).
        firstReturnValue = { id: 1 };

        await grantSubscriptionCredits({
            userId: "u1",
            planId: "indie",
            idempotencyKey: "session-123",
            description: "Indie plan — monthly credits",
        });

        // batch should NOT be called — idempotency check short-circuited.
        expect(batchCalled).toBe(false);
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
        firstReturnValue = { id: 1 }; // Already processed.

        await grantPurchasedCredits({
            userId: "u1",
            credits: 50,
            idempotencyKey: "session-456",
            description: "Purchased 50 credits ($7)",
        });

        expect(batchCalled).toBe(false);
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
        firstReturnValue = { id: 1 }; // Already processed.

        await downgradeToSolo({
            userId: "u1",
            idempotencyKey: "downgrade_sub_123",
        });

        expect(batchCalled).toBe(false);
    });
});
