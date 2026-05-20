"use client";

import dynamic from "next/dynamic";

const AudioEditorMount = dynamic(() => import("./AudioEditorMount"), { ssr: false });

export default function AudioEditorClient() {
    return <AudioEditorMount />;
}
