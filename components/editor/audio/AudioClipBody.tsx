"use client";

/**
 * AudioClipBody — what gets rendered inside an audio clip's body.
 *
 * Composed inside <ClipBlock> via its `renderBody` render-prop. Stays
 * stateless from the frame's perspective — it reads any audio-specific
 * state (envelope visibility, recording id) from the editor store directly.
 */

import { useEditor } from "@/lib/editor/store";
import { usePeaks } from "@/lib/audio/peaks";
import type { ClipBodyContext } from "@/components/editor/shared/ClipBlock";
import VolumeEnvelopeOverlay from "@/components/editor/shared/VolumeEnvelopeOverlay";
import WaveformCanvas from "./WaveformCanvas";

export default function AudioClipBody({
  clip,
  asset,
  width,
  height,
  selected,
  effectiveRgb,
}: ClipBodyContext) {
  const peaks = usePeaks(asset?.id, asset?.url);
  const showVolumeEnvelopes = useEditor((s) => s.showVolumeEnvelopes);
  const selectedTrackId = useEditor((s) => s.selectedTrackId);
  const isRecording = useEditor((s) => s.recordingClipId === clip.id);
  const isOnActiveTrack =
    selectedTrackId != null && clip.trackId === selectedTrackId;

  if (clip.kind !== "audio" && clip.kind !== "video") return null;

  const speed = clip.speed || 1;
  const gain = clip.volume ?? 1;
  const fadeIn = clip.fadeIn ?? 0;
  const fadeOut = clip.fadeOut ?? 0;
  const envelopeVisible = showVolumeEnvelopes && isOnActiveTrack && height > 0;

  return (
    <>
      {isRecording && <RecBadge />}

      {peaks ? (
        <WaveformCanvas
          peaks={peaks}
          inPoint={clip.inPoint}
          duration={clip.duration * speed}
          width={width}
          height={height}
          gain={gain}
          color={
            selected
              ? `rgb(${effectiveRgb})`
              : `rgba(${effectiveRgb}, 0.85)`
          }
          fadeIn={fadeIn}
          fadeOut={fadeOut}
        />
      ) : (
        <DecodingHint />
      )}

      {envelopeVisible && (
        <VolumeEnvelopeOverlay
          clipId={clip.id}
          points={clip.volumePoints}
          duration={clip.duration}
          width={width}
          height={height}
        />
      )}
    </>
  );
}

function RecBadge() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 6,
        right: 6,
        zIndex: 4,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 6px",
        borderRadius: 4,
        background: "rgba(255, 59, 48, 0.85)",
        color: "white",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.6,
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#fff",
          animation: "recordPulse 1.2s ease-in-out infinite",
        }}
      />
      REC
    </div>
  );
}

function DecodingHint() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        color: "rgba(255,255,255,0.4)",
      }}
    >
      decoding…
    </div>
  );
}
