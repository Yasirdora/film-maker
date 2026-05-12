"use client";

import dynamic from "next/dynamic";
import { useLayoutEffect, useRef, useState } from "react";
import PageBar from "@/components/editor/PageBar";
import AudioEditorPageActions, {
  AudioEditorExport,
  AudioEditorKebab,
  AudioEditorUndoRedo,
} from "./AudioEditorPageActions";

const AudioEditor = dynamic(
  () => import("@/components/editor/audio/AudioEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-screen flex items-center justify-center bg-black text-[#95979c] text-sm">
        Loading audio editor…
      </div>
    ),
  },
);

export default function AudioEditorMount() {
  /* Lock the editor to the remaining viewport height so its lanes scroll
     internally instead of pushing the page itself past the viewport.
     `topOffset` measures where the editor mounts (below the layout header
     and PageBar) so the height calc adapts to whatever sits above. */
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
    /* The route owns both the page bar and the editor; the wrapper div
       carries `no-focus-ring` so the global :focus-visible blue ring is
       suppressed across every audio-editor button. Components that need
       a focus indicator draw their own (e.g. .ae-icon-btn:focus-visible). */
    <div className="contents no-focus-ring">
      <PageBar
        breadcrumbs={[
          { label: "Home", href: "/editor" },
          { label: "Audio Editor" },
        ]}
        badge="BETA"
        leadingActions={
          <>
            <AudioEditorKebab />
            <AudioEditorPageActions />
          </>
        }
        actions={
          <>
            <AudioEditorUndoRedo />
            <span
              aria-hidden
              className="self-center w-px h-4 mx-1.5"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.10)" }}
            />
            <AudioEditorExport />
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
        <AudioEditor />
      </div>
    </div>
  );
}
