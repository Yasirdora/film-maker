"use client";

/**
 * AudioTimeline — audio-flavored composition of the shared <Timeline>.
 *
 * The timeline shell, ruler, lanes, drag/snap/loop logic, etc. all live in
 * components/shared/Timeline.tsx. This file just wires in the audio config:
 * see audioTimelineConfig.tsx for the audio-specific knobs.
 */

import Timeline, { type TimelineProps } from "@/components/editor/shared/Timeline";
import { audioTimelineConfig } from "./audioTimelineConfig";

export type AudioTimelineProps = Omit<TimelineProps, "config">;

export default function AudioTimeline(props: AudioTimelineProps) {
  return <Timeline {...props} config={audioTimelineConfig} />;
}
