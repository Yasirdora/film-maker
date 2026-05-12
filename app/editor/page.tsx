/**
 * Editor landing — tool selector at `/editor`.
 *
 * Lists the three browser-side tools (video, audio, converter) as
 * equal-weight tiles. No session state, no project list — sessions are
 * in-memory only.
 */

import type { Metadata } from "next";
import EditorLanding from "@/components/editor/EditorLanding";

export const metadata: Metadata = {
    title: "Editor",
    description:
        "Choose a browser-side editing tool: video editor, audio editor, or media converter.",
};

export default function EditorPage() {
    return <EditorLanding />;
}
