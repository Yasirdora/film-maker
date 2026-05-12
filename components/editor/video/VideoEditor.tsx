"use client";

/**
 * VideoEditor — top-level shell for the video editor.
 *
 * Mounts the same shared chrome the audio editor uses (SideRail, Timeline,
 * FloatingDock, MobileEditingBar) wired with the video config, plus a
 * <PreviewStage> above the timeline for on-canvas composition. Engine
 * plumbing (mediaController + clock-max + media keys + keyboard shortcuts)
 * comes from the same shared hooks the audio editor uses.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useEditor } from "@/lib/editor/store";
import { useIsMobile } from "@/lib/editor/useMediaQuery";
import { importFiles } from "@/lib/editor/importFiles";
import { useEditorEngine } from "@/lib/editor/useEditorEngine";
import { useEditorShortcuts } from "@/lib/editor/useEditorShortcuts";
import { useTransportMediaKeys } from "@/lib/editor/useTransportMediaKeys";
import SideRail from "@/components/editor/shared/SideRail";
import Timeline from "@/components/editor/shared/Timeline";
import FloatingDock from "@/components/editor/shared/FloatingDock";
import MobileEditingBar from "@/components/editor/shared/MobileEditingBar";
import PreviewStage from "@/components/editor/shared/PreviewStage";
import Inspector from "@/components/editor/shared/Inspector";
import CanvasFromQuery from "@/components/editor/shared/CanvasFromQuery";
import Splitter from "@/components/editor/shared/Splitter";
import { VideoEditorToolButtons } from "@/app/editor/video/VideoEditorPageActions";
import { videoTimelineConfig } from "./videoTimelineConfig";
import VideoExportDialog from "./VideoExportDialog";

export default function VideoEditor() {
  const transportToggle = useEditor((s) => s.transportToggle);

  const mode = useEditor((s) => s.mode);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const showHelp = useEditor((s) => s.showHelp);
  const setShowHelp = useEditor((s) => s.setShowHelp);
  const isExporting = useEditor((s) => s.isExporting);
  const setIsExporting = useEditor((s) => s.setExporting);
  const [dragOver, setDragOver] = useState(false);

  /* Engine + transport plumbing — identical to the audio editor, just
     without recorder-aware clock max and without ensureRunning. */
  useEditorEngine();
  useEditorShortcuts();
  useTransportMediaKeys({ transportToggle });

  /* Child drop zones call stopPropagation(); a capture-phase listener clears
     the page-wide overlay regardless. */
  useEffect(() => {
    const reset = () => setDragOver(false);
    document.addEventListener("drop", reset, true);
    return () => document.removeEventListener("drop", reset, true);
  }, []);

  const handleFiles = useCallback(
    (list: FileList | null) => importFiles(list, videoTimelineConfig),
    [],
  );

  const isMobile = useIsMobile();

  return (
    <div
      className="font-ae"
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        background: "var(--color-ae-bg)",
        color: "rgba(255,255,255,1)",
        overflow: "hidden",
        userSelect: "none",
      }}
      onDragOver={
        isMobile
          ? undefined
          : (e) => { e.preventDefault(); setDragOver(true); }
      }
      onDragLeave={
        isMobile
          ? undefined
          : (e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setDragOver(false);
            }
      }
      onDrop={
        isMobile
          ? undefined
          : (e) => {
              e.preventDefault();
              setDragOver(false);
              void handleFiles(e.dataTransfer.files);
            }
      }
    >
      {/* Reads ?w=&h= from the URL on first mount and applies to the canvas
          state. Wrapped in Suspense per useSearchParams' SSR contract. */}
      <Suspense fallback={null}>
        <CanvasFromQuery />
      </Suspense>

      {!isMobile && <SideRail onShowHelp={() => setShowHelp(true)} />}

      <main
        className="flex-grow flex flex-col relative"
        style={{ minWidth: 0, minHeight: 0 }}
      >
        {/* Preview canvas + timeline shell — rounded chrome on desktop,
            edge-to-edge on mobile. On desktop the preview/timeline split
            is user-resizable via Splitter; on mobile we fall back to the
            natural flex layout because dragging a 1px handle on a small
            screen is poor UX and the screen is already short. */}
        <div
          className="flex-grow flex flex-col relative overflow-hidden"
          style={{
            minHeight: 0,
            margin: isMobile ? 0 : "0 12px 12px 0",
            borderRadius: isMobile ? 0 : 16,
            border: isMobile ? "none" : "1px solid rgba(255,255,255,0.12)",
            background: isMobile ? "transparent" : "var(--color-ae-lane)",
            boxShadow: isMobile ? "none" : "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          {isMobile ? (
            <>
              <PreviewStage />
              <Timeline
                config={videoTimelineConfig}
                mode={mode}
                isHeaderCollapsed={isHeaderCollapsed}
                setIsHeaderCollapsed={setIsHeaderCollapsed}
                showHelp={showHelp}
                setShowHelp={setShowHelp}
              />
              <MobileEditingBar>
                <VideoEditorToolButtons menuPlacement="up" />
              </MobileEditingBar>
            </>
          ) : (
            <Splitter
              orientation="vertical"
              storageKey="film-maker:editor.video.preview-timeline"
              defaultRatio={0.6}
              minRatio={0.25}
              maxRatio={0.85}
              handleLabel="Resize video preview and timeline"
            >
              {/* Top pane: preview canvas + properties panel side-by-side.
                  Inspector docks to the right of the canvas only while a
                  clip is selected (it returns null otherwise), so the
                  preview reclaims the full width when there is nothing
                  to configure. */}
              <div className="flex flex-row min-w-0 min-h-0 h-full w-full">
                <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                  <PreviewStage />
                </div>
                <Inspector />
              </div>
              <Timeline
                config={videoTimelineConfig}
                mode={mode}
                isHeaderCollapsed={isHeaderCollapsed}
                setIsHeaderCollapsed={setIsHeaderCollapsed}
                showHelp={showHelp}
                setShowHelp={setShowHelp}
              />
            </Splitter>
          )}
          <FloatingDock />
        </div>
      </main>

      <VideoExportDialog
        open={isExporting}
        onClose={() => setIsExporting(false)}
      />

      {!isMobile && dragOver && (
        <div
          className="pointer-events-none fixed inset-0"
          style={{
            boxShadow: "inset 0 0 0 3px rgba(50,215,75,0.55)",
            background: "rgba(50,215,75,0.04)",
            zIndex: 10000,
          }}
        />
      )}
    </div>
  );
}
