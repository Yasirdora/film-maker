"use client";

import dynamic from "next/dynamic";

const VideoEditorMount = dynamic(() => import("./VideoEditorMount"), { ssr: false });

export default function VideoEditorClient() {
    return <VideoEditorMount />;
}
