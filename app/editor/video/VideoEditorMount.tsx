"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import PageBar from "@/components/editor/PageBar";
import PageKebabMenu from "@/components/editor/shared/PageKebabMenu";
import { ClapperboardLoader } from "@/components/landing-hero/clapperboard-loader";
import { useBootLoader } from "@/lib/editor/useBootLoader";
import VideoEditorPageActions, {
  VideoEditorCanvasButton,
  VideoEditorExport,
  VideoEditorUndoRedo,
} from "./VideoEditorPageActions";

/* Hoisted so both the `dynamic()` proxy and the boot-loader effect
   share the same import promise. `import()` is module-cached, so the
   second call is free and just resolves with the already-loaded chunk. */
const importVideoEditor = () => import("@/components/editor/video/VideoEditor");

const VideoEditor = dynamic(importVideoEditor, {
  ssr: false,
  /* Render nothing in the dynamic slot — the boot-loader overlay below
     covers the viewport while the chunk loads, then fades out via the
     clap animation when the chunk resolves. */
  loading: () => null,
});

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

  /* Watch the editor chunk's import promise; flip `chunkReady` true on
     resolve so `useBootLoader` can run the clap-and-fade sequence. The
     `dynamic()` above triggered the same import, so this `.then` lands
     against the cached promise — no duplicate network work. */
  const [chunkReady, setChunkReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    importVideoEditor().then(() => {
      if (!cancelled) setChunkReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const loaderPhase = useBootLoader(chunkReady);

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
        pageMenu={
          <PageKebabMenu label="Video editor menu">
            {/* Tool-specific items will land here as they ship. The
                slot is wired now so the visual is in place. */}
            <button type="button" className="ui-menu-item" disabled aria-disabled>
              <span className="text-white/50">Tool actions coming soon</span>
            </button>
          </PageKebabMenu>
        }
        leadingActions={<VideoEditorPageActions />}
        actions={
          <>
            <VideoEditorCanvasButton />
            <span
              aria-hidden
              className="self-center w-px h-4 mx-1.5"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.10)" }}
            />
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
      {/* Kept mounted through every phase — including `finished` — so
          the CSS opacity transition has a node to animate against. The
          overlay sits as a fixed-position sibling, so removing it from
          the document flow has no effect on the editor layout. */}
      <ClapperboardLoader phase={loaderPhase} />
    </div>
  );
}
