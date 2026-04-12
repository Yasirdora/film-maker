import Link from "next/link";

export default function HomePage() {
    return (
        <main className="min-h-dvh flex flex-col">
            <header className="px-6 py-5 flex items-center justify-between max-w-5xl mx-auto w-full">
                <span className="text-lg font-semibold tracking-tight">
                    Film-maker
                </span>
                <nav className="flex items-center gap-5 text-sm text-neutral-600 dark:text-neutral-300">
                    <Link href="/pricing" className="hover:text-neutral-900 dark:hover:text-white">
                        Pricing
                    </Link>
                    <Link href="/login" className="hover:text-neutral-900 dark:hover:text-white">
                        Sign in
                    </Link>
                </nav>
            </header>

            <section className="flex-1 px-6 py-16 max-w-3xl mx-auto w-full">
                <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 dark:border-neutral-800 px-3 py-1 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Early access
                </div>
                <h1 className="mt-6 text-4xl sm:text-5xl font-semibold tracking-tight">
                    AI filmmaking, simplified.
                </h1>
                <p className="mt-5 text-lg text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    Film-maker is a web app for generating cinematic images
                    from text prompts, powered by Google&apos;s Nano Banana Pro
                    image model. Describe a shot, pick a style, and get a
                    production-ready image in seconds — all from your phone or
                    desktop.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                        href="/login"
                        className="inline-flex items-center rounded-md bg-neutral-900 dark:bg-white px-5 py-2.5 text-sm font-medium text-white dark:text-neutral-900 hover:opacity-90"
                    >
                        Get started
                    </Link>
                    <Link
                        href="/pricing"
                        className="inline-flex items-center rounded-md border border-neutral-300 dark:border-neutral-700 px-5 py-2.5 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    >
                        See pricing
                    </Link>
                </div>

                <div className="mt-16 grid gap-6 sm:grid-cols-2">
                    <Feature
                        title="Text-to-image generation"
                        body="Turn prompts into cinematic stills using Google's Nano Banana Pro model. Multiple aspect ratios and style presets."
                    />
                    <Feature
                        title="Credit-based, no subscription lock-in"
                        body="Free tier includes 100 credits per month (3/day). Top up only when you need more — no auto-renewing plan required."
                    />
                    <Feature
                        title="Sign in with Google"
                        body="We use Google Sign-In for account authentication only. We request your name, email, and profile picture to identify your account — nothing else."
                    />
                    <Feature
                        title="Your images stay yours"
                        body="Generated images are stored in your private library. You can download or delete them at any time."
                    />
                </div>

                <div className="mt-16 rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
                    <h2 className="text-base font-semibold">
                        How we use Google account data
                    </h2>
                    <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                        When you sign in with Google, Film-maker receives your
                        name, email address, and profile picture. This data is
                        used solely to create and identify your Film-maker
                        account. We do not read your Gmail, Drive, Calendar, or
                        any other Google service data, and we do not sell or
                        share your personal data with third parties for
                        advertising. See our{" "}
                        <Link href="/privacy" className="underline">
                            Privacy Policy
                        </Link>{" "}
                        for full details.
                    </p>
                </div>
            </section>

            <footer className="border-t border-neutral-200 dark:border-neutral-800 px-6 py-8">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                    <span>© {new Date().getFullYear()} Film-maker</span>
                    <nav className="flex items-center gap-5">
                        <Link href="/privacy" className="hover:text-neutral-900 dark:hover:text-white">
                            Privacy
                        </Link>
                        <Link href="/terms" className="hover:text-neutral-900 dark:hover:text-white">
                            Terms
                        </Link>
                        <a
                            href="mailto:ysrdora@gmail.com"
                            className="hover:text-neutral-900 dark:hover:text-white"
                        >
                            Contact
                        </a>
                    </nav>
                </div>
            </footer>
        </main>
    );
}

function Feature({ title, body }: { title: string; body: string }) {
    return (
        <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                {body}
            </p>
        </div>
    );
}
