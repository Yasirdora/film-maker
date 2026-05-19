"use client";

/**
 * VideoEditorMount — composition root for the /editor/video route.
 *
 * Owns the chrome that wraps the editor body: PageBar above, the editor
 * chunk lazily loaded below at viewport-remaining height, and the
 * boot-loader overlay sitting on top until the chunk resolves.
 *
 * Chunk-load failures (CDN miss, deploy mid-rollout) surface as an
 * inline error card with a reload affordance instead of a silent
 * indefinite spinner — see `useEditorChunk`.
 */

import dynamic from "next/dynamic";
import { useLayoutEffect, useRef, useState } from "react";
import PageBar from "@/components/editor/PageBar";
import PageBarDivider from "@/components/editor/shared/PageBarDivider";
import { ClapperboardLoader } from "@/components/landing-hero/clapperboard-loader";
import { useEditorChunk } from "@/lib/editor/useEditorChunk";
import VideoEditorPageActions, {
  NO_VIDEO_MEDIA_TITLE,
  VideoEditorCanvasButton,
} from "./VideoEditorPageActions";
import {
  EditorExportButton,
  EditorUndoRedo,
} from "@/components/editor/shared/EditorPageActions";

/* Hoisted so the `dynamic()` proxy and the boot-loader hook share the
   same import promise — `import()` is module-cached, so the second
   call resolves with the already-loaded chunk and triggers no
   additional network work. The loader is referentially stable because
   it lives at module scope (the hook depends on that). */
const importVideoEditor = () =>
  import("@/components/editor/video/VideoEditor");

const VideoEditor = dynamic(importVideoEditor, {
  ssr: false,
  /* Render nothing in the dynamic slot — the boot-loader overlay below
     covers the viewport while the chunk loads, then fades out via the
     clap animation once the chunk resolves. */
  loading: () => null,
});

export default function VideoEditorMount() {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [topOffset, setTopOffset] = useState(0);
  const chunk = useEditorChunk(importVideoEditor);

  /* Lock the editor body to the viewport-remaining height so its lanes
     scroll internally instead of pushing the page past the viewport.
     `topOffset` measures where the editor body mounts (below the
     layout header and PageBar) so the calc adapts to whatever sits
     above. */
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
            <VideoEditorCanvasButton />
            <PageBarDivider />
            <EditorUndoRedo />
            <PageBarDivider />
            <EditorExportButton noMediaTitle={`${NO_VIDEO_MEDIA_TITLE} export`} />
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
        {chunk.status === "error" ? (
          <ChunkLoadError error={chunk.error} />
        ) : (
          <VideoEditor />
        )}
      </div>
      {/* Kept mounted through every phase — including `finished` — so
          the CSS opacity transition has a node to animate against. The
          overlay sits as a fixed-position sibling, so removing it from
          the document flow has no effect on the editor layout. Hidden
          entirely on the error path: a frozen clapperboard over an
          error card would be both confusing and visually loud. */}
      {chunk.status !== "error" && (
        <ClapperboardLoader phase={chunk.phase} />
      )}
    </div>
  );
}

/**
 * Surfaced when the editor chunk fails to import (network failure,
 * deploy mid-rollout, etc.). The reload button is the simplest recovery
 * — the import is module-cached so a soft retry inside this tab would
 * land against the same failed promise; a full reload re-runs the
 * fetch.
 */
function ChunkLoadError({ error }: { error: Error }) {
  return (
    <div
      role="alert"
      className="h-full w-full flex flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: "var(--color-ae-bg, #000)" }}
    >
      <div className="text-[15px] font-semibold text-white">
        The video editor couldn’t load.
      </div>
      <div className="max-w-[28rem] text-[12px] leading-relaxed text-white/60">
        {error.message ||
          "A network error prevented the editor from starting. Check your connection and try again."}
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center rounded-md px-4 py-1.5 text-[13px] font-semibold transition-colors"
        style={{ backgroundColor: "#e4e4e7", color: "#0a0a0a" }}
      >
        Reload
      </button>
    </div>
  );
}
