"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

type Viewer =
    | { type: "authenticated"; planId: string; totalCredits: number }
    | { type: "anonymous" };

interface Props {
    viewer: Viewer;
    authSlot?: ReactNode;
}

const ArtisticIntelligenceWorkspace = dynamic(
    () => import("./workspace").then((m) => ({ default: m.ArtisticIntelligenceWorkspace })),
    { ssr: false },
);

export default function ArtisticIntelligenceClient({ viewer, authSlot }: Props) {
    return <ArtisticIntelligenceWorkspace viewer={viewer} authSlot={authSlot} />;
}
