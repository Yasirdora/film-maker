"use client";

/**
 * useEditorEngine — boots the per-editor engine plumbing that's identical
 * between every editor (audio, video, future kinds):
 *   1. Owns the MediaController lifetime for the component subtree.
 *   2. Pushes a fresh snapshot of the project graph (assets, clips, tracks)
 *      into the controller whenever the store changes.
 *   3. Keeps the master clock's `max` aligned with the project total
 *      duration so the playhead clamps where playback should stop.
 *
 * Audio's recorder grows the timeline past `totalDuration()` while a take
 * is in progress; clamping the clock during that window would freeze the
 * playhead. Pass `holdMaxWhenRecording: true` to skip the clamp whenever
 * `state.recordingClipId` is set.
 */
import { useEffect } from "react";
import { useEditor } from "./store";
import { clock } from "./clock";
import { mediaController } from "./mediaController";

export type EditorEngineOptions = {
  /** Audio: true (recorder grows the timeline). Video: false (default). */
  holdMaxWhenRecording?: boolean;
};

export function useEditorEngine({ holdMaxWhenRecording = false }: EditorEngineOptions = {}) {
  // 1. MediaController lives for the whole editor session.
  useEffect(() => {
    mediaController.start();
    return () => mediaController.dispose();
  }, []);

  // 2. Push project snapshot whenever the store mutates.
  useEffect(() => {
    const push = () => {
      const s = useEditor.getState();
      mediaController.setSnapshot({
        assets: s.assets,
        clips: s.clips,
        clipOrder: s.clipOrder,
        tracks: s.tracks,
      });
    };
    push();
    return useEditor.subscribe(push);
  }, []);

  // 3. Keep the clock's max aligned with the project total.
  useEffect(() => {
    const sync = () => {
      const s = useEditor.getState();
      if (holdMaxWhenRecording && s.recordingClipId) {
        clock.setMax(Number.POSITIVE_INFINITY);
        return;
      }
      clock.setMax(s.totalDuration());
    };
    sync();
    return useEditor.subscribe(sync);
  }, [holdMaxWhenRecording]);
}
