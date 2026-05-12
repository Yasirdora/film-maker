"use client";

/**
 * AudioFloatingDock — audio-flavored composition of the shared <FloatingDock>.
 *
 * Wires in two audio-specific concerns:
 *   • beforePlay → ensureRunning, which unlocks the AudioContext on the user's
 *     first transport gesture (browsers refuse to start audio without one).
 *   • recorder → live recorder state + toggle, so the dock renders the record
 *     button and treats "recording" as part of the play/pause affordance.
 *
 * Subscribes to the recorder via useSyncExternalStore so the dock re-renders
 * exactly when state flips, with no other audio concerns leaking back into
 * the shared component.
 */

import { useSyncExternalStore } from "react";
import FloatingDock from "@/components/editor/shared/FloatingDock";
import { useEditor } from "@/lib/editor/store";
import { ensureRunning } from "@/lib/editor/audio";
import { onRecorderChange, recorderState } from "@/lib/editor/recorder";

function useRecorderState() {
  return useSyncExternalStore(onRecorderChange, recorderState, () => "idle" as const);
}

export default function AudioFloatingDock() {
  const recorderToggle = useEditor((s) => s.recorderToggle);
  const state = useRecorderState();
  return (
    <FloatingDock
      beforePlay={ensureRunning}
      recorder={{ state, toggle: recorderToggle }}
    />
  );
}
