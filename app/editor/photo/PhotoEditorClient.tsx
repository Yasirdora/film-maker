"use client";

import dynamic from "next/dynamic";

const PhotoEditorMount = dynamic(() => import("./PhotoEditorMount"), { ssr: false });

export default function PhotoEditorClient() {
    return <PhotoEditorMount />;
}
