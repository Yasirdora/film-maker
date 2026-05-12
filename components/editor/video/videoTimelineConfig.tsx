"use client";

/**
 * videoTimelineConfig — supplies the shared <Timeline> with everything
 * video-specific: file filters, the video clip block, and the video-flavored
 * empty-state copy. No track meter, no envelope toggle, no per-track gain
 * (omitted props default to off, so those affordances simply don't render).
 *
 * Mirroring this pattern lets future kinds (image-only, text-only) plug into
 * the same timeline shell with their own filter and clip block.
 */

import type { TimelineConfig } from "@/components/editor/shared/timelineConfig";
import { getFilmstrip } from "@/lib/editor/filmstrip";
import VideoClipBlock from "./VideoClipBlock";

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;

export const videoTimelineConfig: TimelineConfig = {
  kind: "video",
  acceptFile: (f) => f.type.startsWith("video/") || VIDEO_EXT.test(f.name),
  fileInputAccept: "video/*,.mp4,.mov,.m4v,.webm,.mkv,.avi",
  /* Kick off background filmstrip generation as soon as an asset is added.
     The result is cached in lib/editor/filmstrip.ts; <VideoClipBody> reads
     the same cache when it mounts. Errors (unsupported codec, network) are
     swallowed — the body falls back to a "loading…" placeholder. */
  onAssetReady: (asset) => {
    if (asset.kind !== "video") return;
    getFilmstrip(asset.id, asset.url).catch(() => {});
  },
  ClipBlock: VideoClipBlock,
  copy: {
    laneHint: "Drop video here",
    mobileLaneHint: "Tap to add video",
    emptyHeadline: "Drop video files to begin",
    emptySubline: "MP4 · MOV · WebM",
    emptyHeadlineMobile: "Tap to add video",
  },
};
