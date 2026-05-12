/**
 * Shared FFmpeg.wasm loader for the editor module.
 *
 * Two callers need FFmpeg:
 *  1. The video/audio editor's reverse-clip flow (see `reverseMediaFile`).
 *  2. The /editor/converter universal media converter
 *     (see app/editor/converter/conversion.ts).
 *
 * Both share a single lazily-loaded `FFmpeg` instance from this module so
 * the ~30 MB WASM blob is only fetched once per session. The promise is
 * reset on failure so callers can retry.
 *
 * `@ffmpeg/core` is loaded from unpkg via `toBlobURL`. Requires:
 *   • CSP `connect-src` allowing `https://unpkg.com`
 *   • CSP `script-src` and `worker-src` allowing `blob:`
 *
 * Middleware relaxes these only for `/editor/*` paths — the rest of the
 * site keeps the strict baseline (see middleware.ts).
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const FFMPEG_CDN_BASE =
    "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

let ffmpegPromise: Promise<FFmpeg> | null = null;

/**
 * Resolves the shared FFmpeg instance, loading core + wasm on first call.
 * Subsequent calls return the same instance.
 */
export function getFFmpeg(): Promise<FFmpeg> {
    if (ffmpegPromise) return ffmpegPromise;
    ffmpegPromise = (async () => {
        const ffmpeg = new FFmpeg();
        await ffmpeg.load({
            coreURL: await toBlobURL(
                `${FFMPEG_CDN_BASE}/ffmpeg-core.js`,
                "text/javascript",
            ),
            wasmURL: await toBlobURL(
                `${FFMPEG_CDN_BASE}/ffmpeg-core.wasm`,
                "application/wasm",
            ),
        });
        return ffmpeg;
    })();
    ffmpegPromise.catch(() => {
        ffmpegPromise = null;
    });
    return ffmpegPromise;
}

/**
 * Pre-warms the FFmpeg engine so the first user action doesn't pay the
 * ~30 MB download cost. Safe to call multiple times — the load is shared.
 */
export function preloadFFmpeg(): Promise<void> {
    return getFFmpeg().then(() => undefined);
}

/**
 * Reverses a media file via FFmpeg. For video, attempts to reverse both
 * video and audio streams; falls back to video-only if the source has no
 * audio. Returns a new `File` named `<original>_reversed.<ext>`.
 *
 * @param url   Object URL or remote URL of the source media.
 * @param kind  "video" or "audio" — picks the filter chain.
 * @param name  Original filename; used to derive the reversed filename.
 */
export async function reverseMediaFile(
    url: string,
    kind: "video" | "audio",
    name: string,
): Promise<File> {
    const ff = await getFFmpeg();

    const ext = kind === "video" ? ".mp4" : ".wav";
    const inputName = "input" + (kind === "video" ? ".mp4" : ".mp3");
    const outputName = "output" + ext;

    await ff.writeFile(inputName, await fetchFile(url));

    let logs = "";
    const onLog = ({ message }: { message: string }) => {
        logs += message + "\n";
    };
    ff.on("log", onLog);

    try {
        let exitCode: number;
        if (kind === "audio") {
            exitCode = await ff.exec([
                "-i", inputName, "-af", "areverse", outputName,
            ]);
        } else {
            exitCode = await ff.exec([
                "-i", inputName, "-vf", "reverse", "-af", "areverse", outputName,
            ]);
            if (exitCode !== 0) {
                // Source likely has no audio stream — retry without -af.
                exitCode = await ff.exec([
                    "-i", inputName, "-vf", "reverse", outputName,
                ]);
            }
        }

        if (exitCode !== 0) {
            throw new Error(
                `FFmpeg failed to reverse media (exit ${exitCode}).\n${logs}`,
            );
        }

        const data = await ff.readFile(outputName);
        const mimeType = kind === "video" ? "video/mp4" : "audio/wav";
        // `readFile` returns a Uint8Array on a possibly-SharedArrayBuffer.
        // Copy into a fresh ArrayBuffer so the Blob constructor accepts it
        // under TS's strict typing.
        const bytes = typeof data === "string"
            ? new TextEncoder().encode(data)
            : new Uint8Array(data);
        const reversedBlob = new Blob([bytes], { type: mimeType });
        const newName = name.replace(/\.[^/.]+$/, "") + "_reversed" + ext;
        return new File([reversedBlob], newName, { type: mimeType });
    } finally {
        ff.off("log", onLog);
        // Always clean up the virtual filesystem so the next call starts
        // from a clean slate. Failures here are non-fatal.
        try {
            await ff.deleteFile(inputName);
        } catch {
            /* ignore */
        }
        try {
            await ff.deleteFile(outputName);
        } catch {
            /* ignore */
        }
    }
}
