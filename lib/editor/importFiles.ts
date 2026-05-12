/**
 * importFiles — single source of truth for the "user added some files,
 * make clips on the timeline" flow.
 *
 * The audio editor does this in five different places (timeline-wide drop,
 * track header file picker, per-lane drop zone, mobile empty-lane tap,
 * and the timeline-wide empty state). Before this helper, every callsite
 * duplicated the same loop with subtle drift between them. The helper
 * lets each callsite pass:
 *   • how to filter the dropped files (audio vs video etc.),
 *   • what to do once each asset is ready (e.g. kick off peak generation),
 *   • optional placement (track + start time) so multi-file drops lay out
 *     back-to-back from the playhead.
 */
import type { Clip, MediaAsset } from "./types";
import { useEditor } from "./store";
import { probeFile } from "./media";

export type FileImportConfig = {
  /** Predicate that decides whether a dropped file belongs to this timeline.
   *  e.g. audio config returns true for `audio/*` MIME or .mp3/.wav extensions. */
  acceptFile: (file: File) => boolean;
  /** Called once a `MediaAsset` has been registered in the store. Use this to
   *  trigger any background work (audio peak generation, video thumbnails). */
  onAssetReady?: (asset: MediaAsset) => void;
};

export type FileImportOptions = {
  /** Target track id. When omitted, `addClipFromAsset` decides where the clip
   *  goes (typically the first track of the matching kind). */
  trackId?: string;
  /** Time (seconds) where the first imported clip should start. Subsequent
   *  clips are laid back-to-back from this point. When omitted, the store's
   *  default placement applies. */
  startAt?: number;
  /** Called with the start time of the FIRST successfully placed clip. The
   *  audio editor uses this to seek the playhead to the new content. */
  onFirstClipPlaced?: (start: number) => void;
};

/**
 * Probes each accepted file, registers it as an asset, and creates a clip.
 * Errors on a single file are logged and skipped — one bad file never aborts
 * the rest of the batch.
 */
export async function importFiles(
  files: FileList | File[] | null | undefined,
  cfg: FileImportConfig,
  opts: FileImportOptions = {},
): Promise<void> {
  if (!files || files.length === 0) return;

  const { addAsset, addClipFromAsset } = useEditor.getState();
  let cursor = opts.startAt ?? 0;
  let firstPlaced = true;

  for (const file of Array.from(files)) {
    if (!cfg.acceptFile(file)) continue;
    try {
      const asset = await probeFile(file);
      addAsset(asset);
      const init: Partial<Clip> = {};
      if (opts.trackId) init.trackId = opts.trackId;
      if (opts.startAt !== undefined) init.start = cursor;
      const clipId = addClipFromAsset(asset.id, init);
      if (clipId && firstPlaced) {
        opts.onFirstClipPlaced?.(cursor);
        firstPlaced = false;
      }
      // Default duration when probing fails to extract one (e.g. images).
      cursor += asset.duration > 0 ? asset.duration : 5;
      cfg.onAssetReady?.(asset);
    } catch (err) {
      console.error("importFiles: failed for", file.name, err);
    }
  }
}
