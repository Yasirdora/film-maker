"use client";

import dynamic from "next/dynamic";
import { useLayoutEffect, useRef, useState } from "react";
import PageBar from "@/components/editor/PageBar";
import VideoEditorPageActions, {
  VideoEditorExport,
  VideoEditorUndoRedo,
} from "./VideoEditorPageActions";

const VideoEditor = dynamic(
  () => import("@/components/editor/video/VideoEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-screen flex items-center justify-center bg-black text-[#95979c] text-sm">
        Loading video editor…
      </div>
    ),
  },
);

/**
 * Mirrors AudioEditorMount: locks the editor to the remaining viewport
 * height so its lanes/preview scroll internally instead of pushing the page
 * past the viewport. `topOffset` is measured from where the editor mounts
 * (below the layout header and PageBar) so the height calc adapts to
 * whatever sits above.
 */
export default function VideoEditorMount() {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [topOffset, setTopOffset] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      const el = editorRef.current;
      if (el) setTopOffset(el.getBoundingClientRect().top);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div className="contents no-focus-ring">
      <PageBar
        breadcrumbs={[
          { label: "Home", href: "/editor" },
          { label: "Video Editor" },
        ]}
        badge="ALPHA"
        leadingActions={<VideoEditorPageActions />}
        actions={
          <>
            <VideoEditorUndoRedo />
            <span
              aria-hidden
              className="self-center w-px h-4 mx-1.5"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.10)" }}
            />
            <VideoEditorExport />
          </>
        }
      />
      <div
        ref={editorRef}
        style={{
          height: `calc(100dvh - ${topOffset}px)`,
          overflow: "hidden",
        }}
      >
        <VideoEditor />
      </div>
    </div>
  );
}
