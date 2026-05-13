/**
 * Editor layout — shared shell for /editor/* routes.
 *
 * Renders the global `<AppNav />` (editor-style top bar + mobile bottom
 * tab bar) — same as every other interior page. Each child route mounts
 * its own `<PageBar>` underneath for breadcrumbs and toolbar actions.
 *
 * Public route family — no auth guard. The editor runs entirely
 * client-side and persists nothing server-side, so anonymous use is
 * intentional.
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
