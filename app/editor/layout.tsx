/**
 * Editor layout — shared shell for /editor/* routes.
 *
 * Renders the editor's own top bar (`EditorHeader`) with its full nav
 * dropdown set (Artistic Intelligence, Video, Image, Audio, Media
 * Converter), and injects an auth-aware right cluster — sign in /
 * get started for anonymous visitors, profile menu for signed-in users.
 *
 * The header replaces the global `<AppNav />` only on `/editor/*` — the
 * rest of the site keeps the standard nav. Each child page mounts its
 * own `<PageBar>` for breadcrumbs and toolbar actions.
 *
 * Public route family — no auth guard. The editor runs entirely
 * client-side and persists nothing server-side, so anonymous use is
 * intentional.
 */

import type { Metadata } from "next";
import { EditorHeader } from "@/components/editor/EditorHeader";
import { EditorHeaderAuthSlot } from "@/components/editor/EditorHeaderAuthSlot";

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
        <div className="min-h-dvh bg-ws-canvas text-white">
            <EditorHeader rightSlot={<EditorHeaderAuthSlot />} />
            {children}
        </div>
    );
}
