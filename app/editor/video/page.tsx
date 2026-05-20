import type { Metadata } from "next";
import VideoEditorClient from "./VideoEditorClient";

export const metadata: Metadata = {
  title: "Video Editor",
  description:
    "Browser-side video editor: trim, cut, and layer clips on a frame-accurate timeline.",
};

export default function VideoEditorPage() {
  return <VideoEditorClient />;
}
