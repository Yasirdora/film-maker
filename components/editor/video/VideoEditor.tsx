"use client";

/**
 * VideoEditor — body of the /editor/video route.
 *
 * Composes the shared editor chrome (EditorShell + EditorChrome) with
 * the video-specific content: a `<PreviewStage>` over the timeline, a
 * vertical splitter so the user can resize that ratio, and an
 * `<Inspector>` docked as a full-height column on the right. Mobile
 * collapses to a single column, replaces the splitter with stacked
 * panels, and surfaces the tool row in the bottom `<MobileEditingBar>`.
 *
 * Engine plumbing (mediaController, clock-max, media keys, keyboard
 * shortcuts) comes from the same shared hooks the audio editor uses —
 * the only differences are that video has no recorder-aware clock max
 * and no `ensureRunning` gate before play.
 */

import { Suspense, useCallback, useState } from "react";
import { useEditor } from "@/lib/editor/store";
import { useIsMobile } from "@/lib/editor/useMediaQuery";
import { importFiles } from "@/lib/editor/importFiles";
import { useEditorEngine } from "@/lib/editor/useEditorEngine";
import { useEditorShortcuts } from "@/lib/editor/useEditorShortcuts";
import { useTransportMediaKeys } from "@/lib/editor/useTransportMediaKeys";
import EditorShell, { EditorChrome } from "@/components/editor/shared/EditorShell";
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
  const showHelp = useEditor((s) => s.showHelp);
  const setShowHelp = useEditor((s) => s.setShowHelp);
  const isExporting = useEditor((s) => s.isExporting);
  const setIsExporting = useEditor((s) => s.setExporting);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  /* Engine + transport — identical to the audio editor, just without
     recorder-aware clock max and `ensureRunning`. */
  useEditorEngine();
  useEditorShortcuts();
  useTransportMediaKeys({ transportToggle });

  const handleFiles = useCallback(
    (list: FileList | null) => importFiles(list, videoTimelineConfig),
    [],
  );

  const isMobile = useIsMobile();

  return (
    <EditorShell onFiles={handleFiles} onShowHelp={() => setShowHelp(true)}>
      {/* Reads ?w=&h= from the URL on first mount and applies it to the
          canvas state. Wrapped in Suspense per useSearchParams' SSR
          contract. */}
      <Suspense fallback={null}>
        <CanvasFromQuery />
      </Suspense>

      <main
        className="flex-grow flex flex-col relative"
        style={{ minWidth: 0, minHeight: 0 }}
      >
        <EditorChrome direction="row">
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
            <>
              {/* Left column: preview over timeline with a resizable
                  splitter between them. `flex-1` lets the Inspector
                  reclaim space only when it appears (it returns null
                  when no clip is selected). */}
              <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                <Splitter
                  orientation="vertical"
                  storageKey="film-maker:editor.video.preview-timeline"
                  defaultRatio={0.6}
                  minRatio={0.25}
                  maxRatio={0.85}
                  handleLabel="Resize video preview and timeline"
                >
                  <PreviewStage />
                  <Timeline
                    config={videoTimelineConfig}
                    mode={mode}
                    isHeaderCollapsed={isHeaderCollapsed}
                    setIsHeaderCollapsed={setIsHeaderCollapsed}
                    showHelp={showHelp}
                    setShowHelp={setShowHelp}
                  />
                </Splitter>
              </div>
              {/* Right column: full-height properties panel. */}
              <Inspector />
            </>
          )}
          <FloatingDock />
        </EditorChrome>
      </main>

      {/* Remount on every open so the dialog's internal form/view state
          starts from a known baseline. Keeping the dialog in the tree
          while closed would force the consumer to bulk-reset state in
          an effect — see VideoExportDialog for the contract. */}
      {isExporting && (
        <VideoExportDialog onClose={() => setIsExporting(false)} />
      )}
    </EditorShell>
  );
}
