"use client";

/**
 * useTransportMediaKeys — routes OS media keys (MacBook Touch Bar / Pause,
 * Bluetooth headphone play-pause, etc.) through the editor's transport.
 *
 * Without this, the browser sends those keys straight to the most-recently
 * played `<audio>`/`<video>` element — that pauses the element but leaves
 * the master clock running, so the playhead keeps moving and the play
 * button never updates.
 *
 * Audio passes a `beforePlay` of `ensureRunning` so the AudioContext
 * unblocks on the first system-level play press; video can omit it.
 */
import { useEffect } from "react";
import { clock } from "./clock";

export type TransportMediaKeyOptions = {
  transportToggle: () => void;
  beforePlay?: () => void | Promise<void>;
};

export function useTransportMediaKeys({
  transportToggle,
  beforePlay,
}: TransportMediaKeyOptions) {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;

    const handlePlay = () => {
      void beforePlay?.();
      if (!clock.playing()) transportToggle();
    };
    const handlePause = () => {
      if (clock.playing()) transportToggle();
    };
    const handleToggle = () => {
      void beforePlay?.();
      transportToggle();
    };

    try { ms.setActionHandler("play", handlePlay); } catch { /* unsupported */ }
    try { ms.setActionHandler("pause", handlePause); } catch { /* unsupported */ }
    try { ms.setActionHandler("playpause" as MediaSessionAction, handleToggle); } catch { /* unsupported */ }

    const syncState = () => {
      try { ms.playbackState = clock.playing() ? "playing" : "paused"; } catch { /* ignore */ }
    };
    syncState();
    const unsub = clock.subscribePlaying(syncState);

    return () => {
      unsub();
      try { ms.setActionHandler("play", null); } catch { /* ignore */ }
      try { ms.setActionHandler("pause", null); } catch { /* ignore */ }
      try { ms.setActionHandler("playpause" as MediaSessionAction, null); } catch { /* ignore */ }
      try { ms.playbackState = "none"; } catch { /* ignore */ }
    };
  }, [transportToggle, beforePlay]);
}
