/**
 * Landing page — placeholder for Phase 1.
 *
 * Will be replaced in Phase 5 with the real marketing page (hero, feature
 * grid, pricing preview, footer). For now this just proves the build works
 * and shows the current version.
 */

export default function HomePage() {
    return (
        <main className="min-h-dvh flex items-center justify-center px-6">
            <div className="text-center max-w-md">
                <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 dark:border-neutral-800 px-3 py-1 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Under construction
                </div>
                <h1 className="mt-6 text-4xl sm:text-5xl font-semibold tracking-tight">
                    Film-maker
                </h1>
                <p className="mt-4 text-neutral-500 dark:text-neutral-400 text-base leading-relaxed">
                    AI-powered filmmaking, simplified. Coming soon to{" "}
                    <span className="font-medium text-neutral-700 dark:text-neutral-200">
                        film-maker.net
                    </span>
                    .
                </p>
            </div>
        </main>
    );
}
