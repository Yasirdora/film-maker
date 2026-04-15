/**
 * Privacy Policy — public page.
 *
 * Placeholder content until legal counsel provides the final text.
 * Linked from the login form footer.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description: "Film-maker privacy policy.",
};

export default function PrivacyPage() {
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
                    Privacy Policy
                </h1>
                <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                    Last updated: April 2026
                </p>
            </header>

            <section className="mx-auto max-w-3xl px-6 pb-16 sm:pb-24">
                <div className="prose prose-neutral dark:prose-invert max-w-none text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-neutral-950 dark:[&_h2]:text-neutral-50 [&_p]:mb-4">
                    <h2>1. Information We Collect</h2>
                    <p>
                        We collect information you provide directly: your name,
                        email address (via Google OAuth or email sign-in), and the
                        prompts you submit for image generation. We also collect
                        usage data such as IP addresses, browser type, and
                        interaction timestamps.
                    </p>

                    <h2>2. How We Use Your Information</h2>
                    <p>
                        Your information is used to provide and improve the Service,
                        process payments, send verification emails, enforce rate
                        limits, and prevent abuse. Prompts are sent to Google&rsquo;s
                        Gemini API for image generation and are not stored beyond
                        the generation record.
                    </p>

                    <h2>3. Data Storage</h2>
                    <p>
                        Account data is stored in Cloudflare D1 (SQLite). Generated
                        images are stored in Cloudflare R2. Payment information is
                        processed and stored by Stripe — we do not store card
                        numbers or payment credentials on our servers.
                    </p>

                    <h2>4. Third-Party Services</h2>
                    <p>
                        We use the following third-party services that may process
                        your data:
                    </p>
                    <ul className="mb-4 ml-4 list-disc space-y-1">
                        <li>Google (OAuth authentication, Gemini image generation)</li>
                        <li>Stripe (payment processing)</li>
                        <li>Cloudflare (hosting, storage, bot protection)</li>
                    </ul>
                    <p>
                        Each service is governed by its own privacy policy.
                    </p>

                    <h2>5. Data Retention</h2>
                    <p>
                        Account data is retained as long as your account is active.
                        Generated images are stored according to your plan tier.
                        You may request deletion of your account and associated data
                        at any time.
                    </p>

                    <h2>6. Your Rights</h2>
                    <p>
                        You have the right to access, correct, or delete your
                        personal data. You may request account deletion by
                        contacting us. Upon deletion, your account data, projects,
                        and generated images will be permanently removed.
                    </p>

                    <h2>7. Cookies</h2>
                    <p>
                        We use essential cookies for authentication (session tokens).
                        We do not use advertising or analytics cookies. Cloudflare
                        Turnstile may set cookies for bot protection purposes.
                    </p>

                    <h2>8. Security</h2>
                    <p>
                        We use industry-standard security measures including HTTPS,
                        Content Security Policy headers, hashed OTP storage, and
                        Stripe&rsquo;s PCI-compliant payment infrastructure to
                        protect your data.
                    </p>

                    <h2>9. Changes to This Policy</h2>
                    <p>
                        We may update this policy from time to time. We will notify
                        users of material changes via email or in-app notification.
                    </p>

                    <h2>10. Contact</h2>
                    <p>
                        Questions about your privacy? Contact us at{" "}
                        <a
                            href="mailto:privacy@film-maker.net"
                            className="underline underline-offset-2 hover:text-neutral-950 dark:hover:text-neutral-50"
                        >
                            privacy@film-maker.net
                        </a>
                        .
                    </p>
                </div>
            </section>
        </main>
    );
}
