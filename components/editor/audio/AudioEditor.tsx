"use client";

import { useCallback, useEffect, useState } from "react";
import { useEditor } from "@/lib/editor/store";
import { useIsMobile } from "@/lib/editor/useMediaQuery";
import { ensureRunning } from "@/lib/editor/audio";
import { importFiles } from "@/lib/editor/importFiles";
import { useEditorEngine } from "@/lib/editor/useEditorEngine";
import { useEditorShortcuts } from "@/lib/editor/useEditorShortcuts";
import { useTransportMediaKeys } from "@/lib/editor/useTransportMediaKeys";
import SideRail from "@/components/editor/shared/SideRail";
import MobileEditingBar from "@/components/editor/shared/MobileEditingBar";
import { AudioEditorToolButtons } from "@/app/editor/audio/AudioEditorPageActions";
import AudioTimeline from "./AudioTimeline";
import AudioFloatingDock from "./AudioFloatingDock";
import { audioTimelineConfig } from "./audioTimelineConfig";
import RecordPanel from "./RecordPanel";
import ExportDialog from "./ExportDialog";

export default function AudioEditor() {
  const transportToggle = useEditor((s) => s.transportToggle);

  const mode = useEditor((s) => s.mode);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const showHelp = useEditor((s) => s.showHelp);
  const setShowHelp = useEditor((s) => s.setShowHelp);
  const isExporting = useEditor((s) => s.isExporting);
  const setIsExporting = useEditor((s) => s.setExporting);
  const [dragOver, setDragOver] = useState(false);

  /* Engine + transport plumbing — identical to the video editor. */
  useEditorEngine({ holdMaxWhenRecording: true });
  useEditorShortcuts({ beforePlay: ensureRunning });
  useTransportMediaKeys({ transportToggle, beforePlay: ensureRunning });

  /* Child drop handlers call stopPropagation(), so the parent onDrop never
     fires. Use a capture-phase listener on document to always clear the
     dragOver overlay on any drop. */
  useEffect(() => {
    const reset = () => setDragOver(false);
    document.addEventListener("drop", reset, true);
    return () => document.removeEventListener("drop", reset, true);
  }, []);

  /* Global drop — files dropped anywhere on the editor become clips. */
  const handleFiles = useCallback(
    (list: FileList | null) => importFiles(list, audioTimelineConfig),
    [],
  );

  const isMobile = useIsMobile();

  /* Layout — row on desktop (sidebar | main); column on mobile (main only —
     mobile has its own bottom editing/transport bars inside main). */
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
          : (e) => {
              e.preventDefault();
              setDragOver(true);
            }
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
      {/* Desktop-only sidebar (mobile help/settings now live in the kebab). */}
      {!isMobile && <SideRail onShowHelp={() => setShowHelp(true)} />}

      {/* Main content */}
      <main
        className="flex-grow flex flex-col relative"
        style={{ minWidth: 0, minHeight: 0 }}
      >
        <RecordPanel />
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
          <AudioTimeline
            mode={mode}
            isHeaderCollapsed={isHeaderCollapsed}
            setIsHeaderCollapsed={setIsHeaderCollapsed}
            showHelp={showHelp}
            setShowHelp={setShowHelp}
          />
          {/* Mobile-only: editing tools sit between the timeline and transport.
              The dock is shared chrome; the buttons inside are audio-specific. */}
          {isMobile && (
            <MobileEditingBar>
              <AudioEditorToolButtons menuPlacement="up" />
            </MobileEditingBar>
          )}
          <AudioFloatingDock />
        </div>
      </main>

      {/* Overlays */}
      <ExportDialog open={isExporting} onClose={() => setIsExporting(false)} />

      {/* Drag-over overlay — visible green inset ring (desktop only) */}
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
