"use client";

/**
 * VideoClipBlock — video-flavored composition of <ClipBlock>.
 *
 * Mirrors AudioClipBlock: a thin wrapper that supplies the kind-specific
 * body renderer. No audio-specific overrides (no recording-tint, no
 * envelope-vs-fade conflict), so the wrapper is even smaller than its
 * audio counterpart.
 */

import { memo } from "react";
import ClipBlock, { type ClipBlockProps, type ClipBodyContext } from "@/components/editor/shared/ClipBlock";
import VideoClipBody from "./VideoClipBody";

const renderVideoBody = (ctx: ClipBodyContext) => <VideoClipBody {...ctx} />;

export default memo(function VideoClipBlock(props: ClipBlockProps) {
  return <ClipBlock {...props} renderBody={renderVideoBody} />;
});
