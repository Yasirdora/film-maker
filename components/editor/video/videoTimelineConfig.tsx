"use client";

/**
 * videoTimelineConfig — supplies the shared `<Timeline>` with everything
 * video-specific: file filters, the video clip block, and the
 * video-flavored empty-state copy. No track meter, no envelope toggle,
 * no per-track gain (omitted props default to off, so those
 * affordances simply don't render).
 *
 * Mirroring this pattern lets future kinds (image-only, text-only)
 * plug into the same timeline shell with their own filter and clip
 * block.
 */

import type { TimelineConfig } from "@/components/editor/shared/timelineConfig";
import { getFilmstrip } from "@/lib/editor/filmstrip";
import VideoClipBlock from "./VideoClipBlock";

/**
 * Container extensions the video editor accepts. Single source of
 * truth — the regex used by drag-and-drop and the `accept` string
 * passed to the file picker are both derived from this list, so a
 * future "add .flv" lands in exactly one place.
 */
const VIDEO_EXTENSIONS = ["mp4", "mov", "m4v", "webm", "mkv", "avi"] as const;

const VIDEO_EXT_RE = new RegExp(
  `\\.(?:${VIDEO_EXTENSIONS.join("|")})$`,
  "i",
);

const FILE_INPUT_ACCEPT = [
  "video/*",
  ...VIDEO_EXTENSIONS.map((e) => `.${e}`),
].join(",");

export const videoTimelineConfig: TimelineConfig = {
  kind: "video",
  acceptFile: (f) => f.type.startsWith("video/") || VIDEO_EXT_RE.test(f.name),
  fileInputAccept: FILE_INPUT_ACCEPT,
  /* Kick off background filmstrip generation as soon as an asset is
     added. The result is cached in `lib/editor/filmstrip.ts`;
     `<VideoClipBody>` reads the same cache when it mounts. Errors
     (unsupported codec, network) don't propagate — the body falls back
     to a "loading…" placeholder. We log in development so codec
     issues are debuggable; production stays quiet. */
  onAssetReady: (asset) => {
    if (asset.kind !== "video") return;
    getFilmstrip(asset.id, asset.url).catch((err) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `videoTimelineConfig: filmstrip generation failed for ${asset.id}`,
          err,
        );
      }
    });
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
