import type { Metadata } from "next";
import AudioEditorClient from "./AudioEditorClient";

export const metadata: Metadata = {
    title: "Audio Editor",
    description:
        "Browser-side audio editor: multi-track timeline, recording, mixing, and export.",
};

export default function AudioEditorPage() {
    return <AudioEditorClient />;
}
