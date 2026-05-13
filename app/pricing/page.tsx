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
    SOLO_PLAN,
    SOLO_MONTHLY_VIDEO_LIMIT,
    PAID_PLANS_ENABLED,
    type SubscriptionPlan,
} from "@/lib/constants";
import { getSession } from "@/lib/auth-server";
import { getBalance } from "@/lib/credits";
import { cn } from "@/lib/utils";
import { AppNav } from "@/components/app-nav";

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
            <AppNav brandHref={isAuthenticated ? "/studio" : "/"} />

            <section className="mx-auto max-w-5xl px-6 pt-12 pb-12 text-center sm:pt-20">
                <h1 className="text-balance text-[clamp(2rem,5vw,4rem)] font-semibold leading-[1.1] tracking-tight">
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

            <section className="mx-auto max-w-4xl px-6">
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
        <div>
        <div className="rounded-[18px] border border-neutral-800 bg-neutral-900/80 px-6 py-5 backdrop-blur-sm">

            {/* Mobile: stacked · Desktop: single row */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">

                {/* Plan name */}
                <p className="shrink-0 text-2xl font-semibold text-neutral-50 sm:border-r sm:border-neutral-800 sm:pr-6">
                    {plan.name}
                </p>

                {/* Credits */}
                <div className="flex shrink-0 items-end gap-2">
                    <span className="text-[2.6rem] font-semibold leading-none tracking-tight text-neutral-50">
                        {plan.credits}
                    </span>
                    <div className="mb-0.5">
                        <p className="text-sm font-medium leading-none text-neutral-300">credits</p>
                        <p className="mt-1 text-xs leading-none text-neutral-500">/ month</p>
                    </div>
                </div>

                {/* Tagline + features */}
                <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-200">
                        Start for free. No card needed.
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                        {plan.dailyLimit}&nbsp;images/day
                        &nbsp;&nbsp;&middot;&nbsp;&nbsp;
                        {SOLO_MONTHLY_VIDEO_LIMIT}&nbsp;video/month
                        &nbsp;&nbsp;&middot;&nbsp;&nbsp;
                        {plan.maxProjects}&nbsp;projects
                    </p>
                </div>

                {/* CTA — full width on mobile */}
                {isCurrent ? (
                    <div className="flex items-center justify-center rounded-[10px] bg-neutral-800 px-5 py-3 text-xs font-medium text-neutral-400 sm:w-auto">
                        Current plan
                    </div>
                ) : (
                    <Link
                        href={href}
                        className="flex items-center justify-center rounded-[10px] bg-white px-5 py-3 text-xs font-semibold text-black transition-colors hover:bg-neutral-200 active:scale-95 sm:w-auto"
                    >
                        Start Creating — Free
                    </Link>
                )}

            </div>
        </div>
        <p className="mt-3 text-center text-xs text-neutral-600">
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
            <div className="flex-1">
                <h3 className="text-xl font-semibold text-neutral-50">
                    {plan.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                    {plan.description}
                </p>

                {/* Credits — the hero metric. Price is secondary and only
                    shown once paid plans are live to avoid "Pricing TBA"
                    noise during the testing phase. */}
                <div className="mt-8">
                    <div className="flex items-end gap-3 text-neutral-50">
                        <span className="text-6xl font-semibold tracking-tight sm:text-7xl">
                            {plan.credits.toLocaleString()}
                        </span>
                        <div className="mb-1.5">
                            <p className="text-base font-medium text-neutral-300 leading-none">
                                credits
                            </p>
                            {plan.interval && (
                                <p className="mt-1 text-xs text-neutral-500 leading-none">
                                    per month
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Price — only rendered once paid plans are live */}
                    {plan.interval && paidPlansEnabled && (
                        <p className="mt-3 text-sm text-neutral-500">
                            {plan.priceLabel} / month
                        </p>
                    )}
                </div>
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

            {/* Always show all but the last 2 features; those sit behind the "+" toggle */}
            <PlanFeatures
                features={plan.features}
                visibleCount={plan.features.length - 2}
            />
        </div>
    );
}
