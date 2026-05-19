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
        /* `bg-black` (not `bg-ws-canvas`) so the PageBar area sits on
           the same surface as the editor body below it. Both video and
           audio editors use `--color-ae-bg` (#000); matching the layout
           removes the visible color step at the top of the page. */
        <div className="min-h-dvh bg-black text-white pb-[66px] sm:pb-0">
            <AppNav />
            {children}
        </div>
    );
}
