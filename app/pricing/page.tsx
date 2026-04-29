/**
 * Public pricing page.
 *
 * Opens with a cinematic hero ("Start a production with Artistic
 * Intelligence") followed by the free Solo card, then the paid plans
 * (Indie / Creator / Studio). Solo is shown here for discoverability
 * even though it's the default tier activated at signup — the card
 * doubles as the primary call-to-action for logged-out visitors.
 *
 * Always dark to match the landing-page brand aesthetic.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Newsreader } from "next/font/google";

import {
    SUBSCRIPTION_PLANS,
    PAID_PLANS_ENABLED,
    type SubscriptionPlan,
} from "@/lib/constants";
import { getSession } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { cn } from "@/lib/utils";
import { AppNav } from "@/components/app-nav";
import { AppHeader } from "@/components/app-header";

import { UpgradeButton } from "./upgrade-button";
import { PlanFeatures } from "./plan-features";

const newsreader = Newsreader({
    subsets: ["latin"],
    style: ["italic"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-newsreader",
});

export const metadata: Metadata = {
    title: "Pricing",
    description:
        "Start free with Solo, or upgrade for more credits, higher resolution, and no daily limits.",
};

const SOLO_PLAN = SUBSCRIPTION_PLANS.find((p) => p.id === "solo")!;
const PAID_PLANS = SUBSCRIPTION_PLANS.filter((p) => !p.isFree);

export default async function PricingPage() {
    const session = await getSession();
    const currentPlan = session?.user
        ? (await getBalance(session.user.id))?.plan ?? "solo"
        : null;
    const isAuthenticated = !!session?.user;

    return (
        <main
            className={cn(
                newsreader.variable,
                "min-h-dvh bg-neutral-950 text-neutral-50",
                // AppNav is fixed-bottom on mobile, so reserve space
                // so content isn't obscured.
                "pb-[66px] sm:pb-0",
            )}
            style={{ background: "var(--brand-gradient)" }}
        >
            <AppNav />

            <AppHeader
                brandHref={isAuthenticated ? "/studio" : "/"}
                reserveNavSpace
            />

            <section className="mx-auto max-w-5xl px-6 pt-12 pb-12 text-center sm:pt-20">
                <h1 className="text-balance text-[clamp(2.5rem,6.5vw,5.25rem)] font-semibold leading-[1.1] tracking-tight">
                    Start a production with
                </h1>
                <h1
                    className="mt-2 text-balance text-[clamp(2.75rem,6.5vw,5.25rem)] italic leading-[1.1] tracking-tight"
                    style={{
                        fontFamily: "var(--font-newsreader), serif",
                        fontWeight: 500,
                        backgroundImage:
                            "linear-gradient(90deg, #5B7BFF 0%, #B06FE8 33%, #E85A70 66%, #EC9440 100%)",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                    }}
                >
                    Artistic Intelligence
                </h1>
                <p className="mt-6 text-base text-neutral-400 sm:text-lg">
                    Generate, experience, and learn the craft.
                </p>
            </section>

            <section className="mx-auto max-w-3xl px-6">
                <SoloCard
                    plan={SOLO_PLAN}
                    isCurrent={currentPlan === "solo"}
                    isAuthenticated={isAuthenticated}
                />
            </section>

            <section className="mx-auto max-w-7xl px-6 pt-12 pb-16 sm:pt-16 sm:pb-24">
                <h2 className="mb-3 text-center text-sm font-semibold text-neutral-500">
                    Upgrade when you&rsquo;re ready
                </h2>

                {!PAID_PLANS_ENABLED && (
                    <div
                        role="status"
                        className="mx-auto mb-8 max-w-2xl rounded-2xl border border-amber-400/20 bg-amber-400/5 px-5 py-3 text-center text-sm text-amber-200/90"
                    >
                        Film-maker&rsquo;s Artist Intelligence is currently in
                        its beta phase. For the public, only the Solo tier is
                        available free of charge.
                    </div>
                )}

                <div className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {PAID_PLANS.map((plan) => (
                        <PlanCard
                            key={plan.id}
                            plan={plan}
                            currentPlan={currentPlan}
                            isAuthenticated={isAuthenticated}
                            paidPlansEnabled={PAID_PLANS_ENABLED}
                        />
                    ))}
                </div>

                <p className="mt-10 text-center text-xs text-neutral-500">
                    {PAID_PLANS_ENABLED
                        ? "Prices in USD. Taxes calculated at checkout where applicable. Cancel anytime."
                        : "Final pricing will be announced before paid plans go live. Cancel anytime once active."}
                </p>
            </section>
        </main>
    );
}

// ─── Solo card (featured free tier) ────────────────────────────────────────

interface SoloCardProps {
    plan: SubscriptionPlan;
    isCurrent: boolean;
    isAuthenticated: boolean;
}

function SoloCard({ plan, isCurrent, isAuthenticated }: SoloCardProps) {
    const href = isAuthenticated ? "/studio" : "/login?from=/studio";

    return (
        <div className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-8 backdrop-blur-sm sm:p-10">
            <div className="flex items-start justify-between gap-4">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <span className="rounded-md bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-300">
                    Free forever
                </span>
            </div>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-400">
                Perfect for students and solo creators finding their visual
                language. Start experiencing Artistic Intelligence.
            </p>

            <div className="mt-10">
                <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-semibold tracking-tight sm:text-7xl">
                        {plan.credits}
                    </span>
                    <span className="text-2xl font-semibold text-neutral-300 sm:text-3xl">
                        credits
                    </span>
                    <span className="text-xl font-semibold text-neutral-500 sm:text-2xl">
                        *
                    </span>
                </div>
                <p className="mt-2 text-sm text-neutral-400">
                    Generate images &amp; video &middot; Up to 6 projects
                </p>
            </div>

            <div className="mt-8">
                {isCurrent ? (
                    <div className="flex h-12 items-center justify-center rounded-xl bg-neutral-800 text-sm font-medium text-neutral-400">
                        Current plan
                    </div>
                ) : (
                    <Link
                        href={href}
                        className="flex h-12 items-center justify-center rounded-xl bg-white px-6 text-base font-semibold text-black transition-colors hover:bg-neutral-200 active:scale-95"
                    >
                        Start Creating &mdash; Free
                    </Link>
                )}
            </div>

            <p className="mt-6 text-center text-xs text-neutral-500">
                *Daily limits apply &mdash; helping us keep Solo accessible to everyone.
            </p>
        </div>
    );
}

// ─── Paid plan card ────────────────────────────────────────────────────────

interface PlanCardProps {
    plan: SubscriptionPlan;
    currentPlan: string | null;
    isAuthenticated: boolean;
    paidPlansEnabled: boolean;
}

function PlanCard({
    plan,
    currentPlan,
    isAuthenticated,
    paidPlansEnabled,
}: PlanCardProps) {
    const isFeatured = "featured" in plan && plan.featured === true;
    const isCurrent = currentPlan === plan.id;

    // The monthly credit count is already shown as the big number,
    // so drop it from the inline feature list to avoid duplication.
    const inlineFeatures = plan.features.filter(
        (f) => !/^\d+[,\d]*\s*credits/i.test(f),
    );

    return (
        <div
            className={cn(
                "relative flex flex-col rounded-3xl border border-neutral-800 bg-neutral-900/60 p-8 backdrop-blur-sm transition-colors",
                // At the 2-col breakpoint the 3rd card (Studio) would
                // sit alone on a new row — span both columns so it fills
                // the row cleanly.
                "sm:last:col-span-2 lg:last:col-span-1",
            )}
        >
            {/* Main content — flex-1 so the button below stays anchored
                right after this block, regardless of the expanded state. */}
            <div className="flex-1">
                <h3 className="text-xl font-semibold text-neutral-50">
                    {plan.name}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                    {plan.description}
                </p>

                <div className="mt-8">
                    <div className="flex items-baseline gap-2 text-neutral-50">
                        <span className="text-4xl font-semibold tracking-tight sm:text-6xl">
                            {plan.credits.toLocaleString()}
                        </span>
                        <span className="text-xl font-semibold text-neutral-300 sm:text-2xl">
                            credits
                        </span>
                    </div>
                    {plan.interval && (
                        <p className="mt-2 text-sm text-neutral-400">
                            {paidPlansEnabled ? (
                                `${plan.priceLabel}/mo`
                            ) : (
                                <span className="font-medium text-neutral-300">
                                    Pricing TBA
                                </span>
                            )}
                        </p>
                    )}
                </div>

                {inlineFeatures.length > 0 && (
                    <p className="mt-6 text-sm leading-relaxed text-neutral-400">
                        {inlineFeatures.join(", ")}
                    </p>
                )}
            </div>

            <div className="pt-8">
                <UpgradeButton
                    planId={plan.id}
                    planName={plan.name}
                    isCurrent={isCurrent}
                    isAuthenticated={isAuthenticated}
                    isFeatured={isFeatured}
                    paidPlansEnabled={paidPlansEnabled}
                />
            </div>

            <PlanFeatures features={plan.features} />
        </div>
    );
}
