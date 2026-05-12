"use client";

/**
 * TimelineConfig — everything the shared <Timeline> needs to know about the
 * media kind it's editing. Each editor (audio, video) supplies its own config
 * and the Timeline stays generic.
 *
 * The config is exposed via React context so deeply nested children
 * (track headers, empty-lane drop zones, mobile rows) can read it without
 * prop drilling.
 */

import { createContext, useContext, type ComponentType, type ReactNode } from "react";
import type { Track } from "@/lib/editor/types";
import type { ClipBlockProps } from "./ClipBlock";
import type { FileImportConfig } from "@/lib/editor/importFiles";

export type TimelineKind = "audio" | "video";

export type TimelineCopy = {
  /** Per-track empty-lane affordance: "Drop audio here", "Drop video here". */
  laneHint: string;
  /** Mobile per-track tap-to-add affordance. */
  mobileLaneHint: string;
  /** Headline shown in the timeline-wide empty state on desktop. */
  emptyHeadline: string;
  /** Subtext under the headline (file format hint). */
  emptySubline: string;
  /** Mobile timeline-wide empty state. */
  emptyHeadlineMobile: string;
};

export type TimelineConfig = FileImportConfig & {
  /** Discriminator. Lets feature-flagged code branch on the timeline kind. */
  kind: TimelineKind;
  /** What goes into <input type="file" accept="…">. */
  fileInputAccept: string;
  /** Clip block to render inside lanes. Audio passes its own audio-flavored
   *  composition; video will pass a video-flavored one. */
  ClipBlock: ComponentType<ClipBlockProps>;
  /** Optional vertical meter shown in the desktop track header.
   *  Audio renders a level meter; video typically returns null. */
  renderTrackMeter?: (track: Track) => ReactNode;
  /** Optional element shown in the timeline header next to the collapse
   *  button. Audio uses this for the volume-envelope toggle. */
  renderHeaderExtras?: () => ReactNode;
  /** Setter for per-track linear gain (0..2). Audio wires this to the Web
   *  Audio gain node; video can omit. */
  onTrackGainChange?: (trackId: string, linearGain: number) => void;
  /** Localized copy for empty-state and lane hints. */
  copy: TimelineCopy;
};

/* ── React context ───────────────────────────────────────────────────── */

const TimelineConfigContext = createContext<TimelineConfig | null>(null);

export function TimelineConfigProvider({
  config,
  children,
}: {
  config: TimelineConfig;
  children: ReactNode;
}) {
  return (
    <TimelineConfigContext.Provider value={config}>
      {children}
    </TimelineConfigContext.Provider>
  );
}

/** Reads the timeline config. Throws when called outside <TimelineConfigProvider>. */
export function useTimelineConfig(): TimelineConfig {
  const cfg = useContext(TimelineConfigContext);
  if (!cfg) {
    throw new Error(
      "useTimelineConfig() called outside <TimelineConfigProvider>. " +
        "Make sure the component is rendered inside <Timeline>.",
    );
  }
  return cfg;
}
