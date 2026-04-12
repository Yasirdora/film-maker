/**
 * Dashboard — placeholder for Phase 2.
 *
 * Used as the default callback target after sign-in. Full dashboard
 * (project grid, quick-create, credit balance) lands in Phase 5.
 * For now we prove the auth loop works by showing the signed-in email.
 */

import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth-server";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = {
    title: "Dashboard",
};

export default async function DashboardPage() {
    const { user } = await requireOnboardedUser();

    return (
        <main className="min-h-dvh flex items-center justify-center px-6">
            <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-950">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Dashboard — placeholder
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                    Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}
                </h1>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                    Signed in as{" "}
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {user.email}
                    </span>
                </p>
                <div className="mt-8">
                    <SignOutButton />
                </div>
            </div>
        </main>
    );
}
