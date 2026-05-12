"use client";

/**
 * audioTimelineConfig — supplies the shared <Timeline> with everything
 * audio-specific: file filters, peak-generation kickoff, the audio clip
 * block, the per-track level meter, the volume-envelope header toggle,
 * and the audio-flavored empty-state copy.
 *
 * Mirroring this for the video editor would create a `videoTimelineConfig`
 * with kind="video", a video file filter, a video clip block, no track
 * meter, and video-flavored copy.
 */

import { setTrackGain } from "@/lib/editor/audio";
import { getPeaks } from "@/lib/audio/peaks";
import type { TimelineConfig } from "@/components/editor/shared/timelineConfig";
import AudioClipBlock from "./AudioClipBlock";
import VerticalTrackMeter from "./VerticalTrackMeter";
import VolumeEnvelopeToggle from "./VolumeEnvelopeToggle";

const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|flac|opus)$/i;

export const audioTimelineConfig: TimelineConfig = {
  kind: "audio",
  acceptFile: (f) => f.type.startsWith("audio/") || AUDIO_EXT.test(f.name),
  fileInputAccept: "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus",
  /* Peak generation runs in the background — failures are non-fatal (the
     waveform shows a "decoding…" placeholder) so we swallow rejections. */
  onAssetReady: (asset) => {
    getPeaks(asset.id, asset.url).catch(() => {});
  },
  ClipBlock: AudioClipBlock,
  renderTrackMeter: (track) => <VerticalTrackMeter trackId={track.id} width={6} />,
  renderHeaderExtras: () => <VolumeEnvelopeToggle />,
  onTrackGainChange: (trackId, linear) => setTrackGain(trackId, linear),
  copy: {
    laneHint: "Drop audio here",
    mobileLaneHint: "Tap to add audio",
    emptyHeadline: "Drop audio files to begin — or hit record",
    emptySubline: "MP3 · WAV · M4A · OGG · FLAC",
    emptyHeadlineMobile: "Tap to add audio",
  },
};
