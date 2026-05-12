/**
 * Editor layout — shared shell for /editor/* routes.
 *
 * Provides the always-dark workspace background and renders the global
 * `<AppNav />` so the site nav is consistent across the product. Each
 * child page mounts its own `<PageBar>` for breadcrumbs and toolbar
 * actions (see PageBar.tsx).
 *
 * Public route family — no auth guard. The editor runs entirely
 * client-side and persists nothing server-side, so anonymous use is
 * intentional. Signed-in users still get the profile menu via AppNav.
 */

import type { Metadata } from "next";
import { AppNav } from "@/components/app-nav";

export const metadata: Metadata = {
    title: {
        default: "Editor",
        template: "%s · Film-maker Editor",
    },
    description:
        "Browser-side video, audio, and media-conversion tools. Files never leave your device.",
};

export default function EditorLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <div className="min-h-dvh bg-ws-canvas text-white pb-[66px] sm:pb-0">
            <AppNav />
            {children}
        </div>
    );
}
