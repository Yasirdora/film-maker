import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Terms of Service",
    description: "The rules for using Film-maker.",
};

const LAST_UPDATED = "April 12, 2026";
const CONTACT_EMAIL = "ysrdora@gmail.com";

export default function TermsPage() {
    return (
        <main className="min-h-dvh">
            <header className="px-6 py-5 max-w-3xl mx-auto w-full">
                <Link
                    href="/"
                    className="text-lg font-semibold tracking-tight hover:opacity-80"
                >
                    Film-maker
                </Link>
            </header>

            <article className="px-6 pb-20 max-w-3xl mx-auto prose prose-neutral dark:prose-invert">
                <h1 className="text-3xl font-semibold tracking-tight">
                    Terms of Service
                </h1>
                <p className="text-sm text-neutral-500">
                    Last updated: {LAST_UPDATED}
                </p>

                <Section title="1. Acceptance">
                    By creating an account or using Film-maker (the
                    &ldquo;Service&rdquo;), you agree to these Terms of
                    Service. If you do not agree, do not use the Service.
                </Section>

                <Section title="2. The service">
                    Film-maker is a web application that generates images from
                    text prompts using Google&apos;s generative AI models. The
                    Service may evolve over time; features may be added,
                    changed, or removed.
                </Section>

                <Section title="3. Accounts">
                    You must sign in with a Google account or an email magic
                    link to use most features. You are responsible for keeping
                    your login credentials secure and for all activity on your
                    account. You must be at least 13 years old (or the minimum
                    age of digital consent in your country) to use the Service.
                </Section>

                <Section title="4. Credits, free tier, and payments">
                    <ul>
                        <li>
                            Free accounts receive a monthly allowance of
                            credits with a daily cap. Exact limits are shown in
                            the app and may change.
                        </li>
                        <li>
                            Additional credits can be purchased through Stripe.
                            Credits are non-refundable except where required by
                            law.
                        </li>
                        <li>
                            Credits have no cash value and cannot be
                            transferred between accounts.
                        </li>
                        <li>
                            We may suspend or revoke credits obtained through
                            fraud, abuse, or violation of these Terms.
                        </li>
                    </ul>
                </Section>

                <Section title="5. Acceptable use">
                    <p>You agree not to use the Service to generate content that:</p>
                    <ul>
                        <li>Is illegal, infringes others&apos; rights, or violates any applicable law</li>
                        <li>Is sexual content involving minors, or non-consensual sexual content</li>
                        <li>Depicts real, identifiable people in a false or defamatory light, or without consent where required</li>
                        <li>Incites violence, harassment, or hatred against individuals or groups</li>
                        <li>Is designed to deceive, defraud, or impersonate others</li>
                        <li>Violates Google&apos;s{" "}
                            <a
                                href="https://policies.google.com/terms/generative-ai/use-policy"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Generative AI Prohibited Use Policy
                            </a>
                        </li>
                    </ul>
                    <p>
                        You also agree not to attempt to reverse-engineer,
                        scrape, overload, or circumvent the technical
                        limitations of the Service.
                    </p>
                </Section>

                <Section title="6. Your content">
                    You retain ownership of the prompts you submit. Subject to
                    Google&apos;s own terms for its image-generation models,
                    you also own the images you generate through the Service.
                    You grant Film-maker a limited license to store and process
                    your prompts and generated images for the purpose of
                    operating the Service. You are responsible for ensuring
                    that your use of generated images complies with applicable
                    law and third-party rights.
                </Section>

                <Section title="7. Our intellectual property">
                    Film-maker&apos;s name, logo, website, and underlying
                    software are owned by us and protected by intellectual
                    property laws. These Terms do not grant you any rights to
                    our trademarks or branding.
                </Section>

                <Section title="8. Disclaimers">
                    The Service is provided &ldquo;as is&rdquo; and &ldquo;as
                    available&rdquo; without warranties of any kind, express
                    or implied, including fitness for a particular purpose,
                    non-infringement, and accuracy. AI-generated output may be
                    inaccurate, offensive, or unsuitable for a given use case;
                    you are responsible for reviewing it before using it.
                </Section>

                <Section title="9. Limitation of liability">
                    To the fullest extent permitted by law, Film-maker and its
                    operators will not be liable for any indirect, incidental,
                    special, consequential, or punitive damages, or for lost
                    profits, revenues, or data, arising out of your use of the
                    Service. Our total liability for any claim will not exceed
                    the amount you paid us in the twelve months preceding the
                    claim, or USD 50, whichever is greater.
                </Section>

                <Section title="10. Termination">
                    You may stop using the Service at any time and request
                    account deletion by emailing{" "}
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We
                    may suspend or terminate your access if you violate these
                    Terms or if required by law.
                </Section>

                <Section title="11. Changes">
                    We may update these Terms from time to time. If we make
                    material changes, we will notify you in the app or via the
                    email on file. Continued use of the Service after changes
                    take effect constitutes acceptance of the new Terms.
                </Section>

                <Section title="12. Governing law">
                    These Terms are governed by the laws of the jurisdiction in
                    which Film-maker is operated, without regard to
                    conflict-of-laws principles.
                </Section>

                <Section title="13. Contact">
                    Questions about these Terms? Email{" "}
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                </Section>
            </article>
        </main>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="mt-8">
            <h2 className="text-xl font-semibold">{title}</h2>
            <div className="mt-2 text-neutral-700 dark:text-neutral-300 leading-relaxed">
                {children}
            </div>
        </section>
    );
}
