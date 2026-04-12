import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description:
        "How Film-maker collects, uses, and protects your personal data.",
};

const LAST_UPDATED = "April 12, 2026";
const CONTACT_EMAIL = "ysrdora@gmail.com";

export default function PrivacyPage() {
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
                    Privacy Policy
                </h1>
                <p className="text-sm text-neutral-500">
                    Last updated: {LAST_UPDATED}
                </p>

                <Section title="1. Introduction">
                    Film-maker (&ldquo;Film-maker&rdquo;, &ldquo;we&rdquo;,
                    &ldquo;our&rdquo;) is a web application that generates
                    cinematic images from text prompts using Google&apos;s
                    generative AI models. This Privacy Policy explains what
                    personal data we collect, how we use it, and the choices
                    you have. It applies to the website at{" "}
                    <a href="https://film-maker.net">https://film-maker.net</a>{" "}
                    and all related services.
                </Section>

                <Section title="2. Data we collect">
                    <p>We collect only the data we need to operate the service:</p>
                    <ul>
                        <li>
                            <strong>Account data from Google Sign-In.</strong>{" "}
                            When you sign in with Google, we receive your name,
                            email address, and profile picture from your Google
                            account. We use these fields solely to create and
                            identify your Film-maker account.
                        </li>
                        <li>
                            <strong>Account data from email sign-in.</strong>{" "}
                            If you sign in with a magic link, we store the
                            email address you provide.
                        </li>
                        <li>
                            <strong>Usage data.</strong> We store the prompts
                            you submit, the images generated from them, your
                            credit balance, and the timestamps of these events,
                            so that you can access your library and we can
                            enforce usage limits.
                        </li>
                        <li>
                            <strong>Payment data.</strong> If you purchase
                            credits, payments are processed by Stripe. We
                            receive a transaction ID and status from Stripe but
                            we do not store your card details on our servers.
                        </li>
                        <li>
                            <strong>Technical data.</strong> Our hosting
                            provider (Cloudflare) may log IP addresses,
                            user-agent strings, and request timestamps for
                            security and abuse-prevention purposes.
                        </li>
                    </ul>
                </Section>

                <Section title="3. How we use Google user data">
                    <p>
                        Film-maker&apos;s use of information received from
                        Google APIs adheres to the{" "}
                        <a
                            href="https://developers.google.com/terms/api-services-user-data-policy"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Google API Services User Data Policy
                        </a>
                        , including the Limited Use requirements.
                    </p>
                    <p>
                        We request only the <code>openid</code>,{" "}
                        <code>email</code>, and <code>profile</code> scopes.
                        These give us your name, email address, and profile
                        picture, which we use exclusively to:
                    </p>
                    <ul>
                        <li>Create and authenticate your Film-maker account</li>
                        <li>Display your name and avatar inside the app</li>
                        <li>
                            Contact you about your account (e.g. payment
                            receipts, security notices)
                        </li>
                    </ul>
                    <p>
                        We <strong>do not</strong> read, write, or access any
                        other Google service data (Gmail, Drive, Calendar,
                        Contacts, Photos, etc.). We do not use Google user data
                        for advertising, and we do not sell it or transfer it
                        to third parties except as required to provide the
                        service (e.g. our hosting and authentication
                        infrastructure) or by law.
                    </p>
                </Section>

                <Section title="4. How we use your data">
                    <ul>
                        <li>To provide the core service (image generation, library, credits)</li>
                        <li>To process payments and deliver purchased credits</li>
                        <li>To enforce free-tier limits and prevent abuse</li>
                        <li>To communicate with you about your account</li>
                        <li>To comply with legal obligations</li>
                    </ul>
                    <p>
                        We do not use your prompts or generated images to train
                        AI models. We do not sell your personal data.
                    </p>
                </Section>

                <Section title="5. Data storage and third parties">
                    <p>
                        Your data is stored on infrastructure provided by
                        Cloudflare (D1 database, R2 object storage, Workers).
                        We share data only with service providers necessary to
                        operate Film-maker:
                    </p>
                    <ul>
                        <li>
                            <strong>Google</strong> — authentication and image
                            generation (Gemini / Nano Banana Pro APIs)
                        </li>
                        <li>
                            <strong>Cloudflare</strong> — hosting, database,
                            object storage
                        </li>
                        <li>
                            <strong>Stripe</strong> — payment processing
                        </li>
                    </ul>
                    <p>
                        Each of these providers processes data under their own
                        privacy terms.
                    </p>
                </Section>

                <Section title="6. Data retention">
                    We retain your account data for as long as your account is
                    active. You can delete your account and all associated data
                    at any time by emailing us at{" "}
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                    After deletion, backups are purged within 30 days.
                </Section>

                <Section title="7. Your rights">
                    Depending on where you live, you may have rights to access,
                    correct, export, or delete your personal data, and to
                    object to or restrict certain processing. To exercise any
                    of these rights, contact us at{" "}
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                </Section>

                <Section title="8. Security">
                    We use HTTPS for all traffic, store credentials only as
                    hashed tokens, and rely on Cloudflare&apos;s
                    infrastructure-level protections. No system is perfectly
                    secure; we will notify affected users of any breach that
                    materially affects their data.
                </Section>

                <Section title="9. Children">
                    Film-maker is not directed at children under 13 and we do
                    not knowingly collect personal data from them.
                </Section>

                <Section title="10. Changes to this policy">
                    We may update this Privacy Policy from time to time. The
                    &ldquo;Last updated&rdquo; date above reflects the most
                    recent revision. Material changes will be announced in the
                    app.
                </Section>

                <Section title="11. Contact">
                    Questions about this Privacy Policy? Email{" "}
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
