import type { Metadata } from "next";
import VideoEditorMount from "./VideoEditorMount";

export const metadata: Metadata = {
  title: "Video Editor",
  description:
    "Browser-side video editor: trim, cut, and layer clips on a frame-accurate timeline.",
};

export default function VideoEditorPage() {
  return <VideoEditorMount />;
}
