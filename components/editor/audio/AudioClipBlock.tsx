"use client";

/**
 * AudioClipBlock — audio-flavored composition of <ClipBlock>.
 *
 * Subscribes to the audio-specific store slices (live recording id, volume
 * envelope visibility, active track) and forwards the derived flags to the
 * shared frame. The waveform + envelope rendering itself lives in
 * <AudioClipBody>, wired in via ClipBlock's `renderBody` render-prop.
 *
 * Keep this file small: anything generic to all clip kinds belongs in
 * components/shared/ClipBlock.tsx. Anything specific to audio (waveform,
 * envelope, REC badge) belongs in AudioClipBody.tsx.
 */

import { memo } from "react";
import ClipBlock, { type ClipBlockProps, type ClipBodyContext } from "@/components/editor/shared/ClipBlock";
import { useEditor } from "@/lib/editor/store";
import AudioClipBody from "./AudioClipBody";

/* Hoisted so the render-prop reference is stable across renders — keeps the
   memoized inner ClipBlock from re-rendering on every parent update. */
const renderAudioBody = (ctx: ClipBodyContext) => <AudioClipBody {...ctx} />;

const RECORDING_RGB = "255, 59, 48";

type Props = Omit<
  ClipBlockProps,
  "isMuted" | "colorOverride" | "hideFades" | "renderBody"
>;

export default memo(function AudioClipBlock(props: Props) {
  const isRecording = useEditor((s) => s.recordingClipId === props.clip.id);
  const showVolumeEnvelopes = useEditor((s) => s.showVolumeEnvelopes);
  const selectedTrackId = useEditor((s) => s.selectedTrackId);
  const isOnActiveTrack =
    selectedTrackId != null && props.clip.trackId === selectedTrackId;

  /* While recording, clip.disabled is repurposed as "bypass during preview" —
     don't dim the visual or it'll look like a muted take. */
  const isMuted = props.clip.disabled && !isRecording;
  /* The envelope overlay occupies the same area as the fade UI, so suppress
     fades whenever the envelope would render. */
  const hideFades = showVolumeEnvelopes && isOnActiveTrack;

  return (
    <ClipBlock
      {...props}
      isMuted={isMuted}
      colorOverride={isRecording ? RECORDING_RGB : undefined}
      hideFades={hideFades}
      renderBody={renderAudioBody}
    />
  );
});
