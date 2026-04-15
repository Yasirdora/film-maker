/**
 * Terms of Service — public page.
 *
 * Placeholder content until legal counsel provides the final text.
 * Linked from the login form footer.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Terms of Service",
    description: "Film-maker terms of service.",
};

export default function TermsPage() {
    return (
        <main className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
            <header className="mx-auto max-w-3xl px-6 pt-12 pb-8 sm:pt-20 sm:pb-12">
                <Link
                    href="/"
                    className="text-sm font-semibold tracking-tight text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
                >
                    &larr; Film-maker
                </Link>
                <h1 className="mt-8 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl dark:text-neutral-50">
                    Terms of Service
                </h1>
                <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                    Last updated: April 2026
                </p>
            </header>

            <section className="mx-auto max-w-3xl px-6 pb-16 sm:pb-24">
                <div className="prose prose-neutral dark:prose-invert max-w-none text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-neutral-950 dark:[&_h2]:text-neutral-50 [&_p]:mb-4">
                    <h2>1. Acceptance of Terms</h2>
                    <p>
                        By accessing or using Film-maker (&ldquo;the Service&rdquo;),
                        you agree to be bound by these Terms of Service. If you do
                        not agree, do not use the Service.
                    </p>

                    <h2>2. Description of Service</h2>
                    <p>
                        Film-maker is an AI-powered image generation platform. The
                        Service allows users to create images using generative AI
                        models. Features, models, and pricing are subject to change.
                    </p>

                    <h2>3. Account Registration</h2>
                    <p>
                        You must provide accurate information when creating an
                        account. You are responsible for maintaining the security of
                        your account credentials and for all activity under your
                        account.
                    </p>

                    <h2>4. Acceptable Use</h2>
                    <p>
                        You agree not to use the Service to generate content that is
                        illegal, harmful, abusive, or violates the rights of others.
                        We reserve the right to suspend or terminate accounts that
                        violate this policy.
                    </p>

                    <h2>5. Credits and Billing</h2>
                    <p>
                        The Service operates on a credit-based system. Subscription
                        credits refresh monthly and do not roll over. Purchased
                        credits are permanent and do not expire. All payments are
                        processed through Stripe. Prices are in USD and taxes are
                        calculated at checkout where applicable.
                    </p>

                    <h2>6. Intellectual Property</h2>
                    <p>
                        You retain ownership of prompts you provide. Images generated
                        through the Service are subject to the usage rights granted
                        by your subscription plan. Free plan output is for personal
                        use only. Paid plans include a commercial license.
                    </p>

                    <h2>7. Limitation of Liability</h2>
                    <p>
                        The Service is provided &ldquo;as is&rdquo; without
                        warranties of any kind. We are not liable for any indirect,
                        incidental, or consequential damages arising from your use
                        of the Service.
                    </p>

                    <h2>8. Changes to Terms</h2>
                    <p>
                        We may update these terms from time to time. Continued use
                        of the Service after changes constitutes acceptance of the
                        updated terms.
                    </p>

                    <h2>9. Contact</h2>
                    <p>
                        Questions about these terms? Contact us at{" "}
                        <a
                            href="mailto:support@film-maker.net"
                            className="underline underline-offset-2 hover:text-neutral-950 dark:hover:text-neutral-50"
                        >
                            support@film-maker.net
                        </a>
                        .
                    </p>
                </div>
            </section>
        </main>
    );
}
