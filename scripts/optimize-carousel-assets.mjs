#!/usr/bin/env node
/**
 * Build-time optimizer for SpatialCarousel video assets.
 *
 * For every clip in public/assets/carousel/, generates:
 *   - public/assets/carousel/web/<name>.mp4     (720p H.264 ~1.5 Mbps, no audio,
 *                                                faststart for instant playback)
 *   - public/assets/carousel/posters/<name>.webp (first-frame WebP @ q=80,
 *                                                 ~20 KB — 25–35% smaller than
 *                                                 the JPG equivalent)
 *
 * Tool pipeline:
 *   1. ffmpeg → 720p H.264 .mp4   (single-step)
 *   2. ffmpeg → temp PNG → cwebp → .webp   (two-step; not every ffmpeg
 *      ships with libwebp, so we keep the encoder external)
 *
 * The manifest generator (scripts/generate-carousel-manifest.mjs) wires the
 * optimized .mp4 into the slide's `video` field and the poster into `poster`,
 * with the original file as a fallback when no optimized output exists.
 *
 * Idempotent: skips clips whose outputs already exist and are newer than the
 * source. Run manually after adding new clips:
 *
 *     npm run carousel:optimize
 *
 * Requires `ffmpeg` and `cwebp` on PATH. If either is missing the script
 * logs an install hint and exits 0 — keeps `npm run build` from breaking
 * on machines without these tools (CI / Cloudflare's build sandbox). The
 * optimized + poster files are committed alongside the originals so
 * deploys don't need either tool.
 *
 *     macOS:  brew install ffmpeg webp
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const SRC_DIR = path.join(projectRoot, "public/assets/carousel");
const WEB_DIR = path.join(SRC_DIR, "web");
const POSTER_DIR = path.join(SRC_DIR, "posters");
const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

/* ------------------------------------------------------------------ */
/*  ffmpeg pipelines                                                    */
/* ------------------------------------------------------------------ */

/** ffmpeg: extract frame at 0.5s as a PNG, scaled to 720px wide. */
const POSTER_FRAME_ARGS = (src, pngOut) => [
    "-ss", "0.5",
    "-i", src,
    "-vframes", "1",
    "-vf", "scale=720:-2",
    "-y",
    pngOut,
];

/** cwebp: PNG → WebP, quality 80, max compression effort, no stdout chatter. */
const POSTER_WEBP_ARGS = (pngIn, webpOut) => [
    "-q", "80",
    "-m", "6",
    "-quiet",
    "-o", webpOut,
    pngIn,
];

/** 720p H.264 main profile, 1.5 Mbps target, no audio, faststart. */
const WEB_ARGS = (src, out) => [
    "-i", src,
    "-vf", "scale=720:-2",
    "-c:v", "libx264",
    "-profile:v", "main",
    "-level", "4.0",
    "-preset", "medium",
    "-b:v", "1500k",
    "-maxrate", "1800k",
    "-bufsize", "3000k",
    "-movflags", "+faststart",
    "-an",
    "-y",
    out,
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

async function hasTool(name) {
    try {
        await exec(name, ["-version"]);
        return true;
    } catch {
        return false;
    }
}

/** ffmpeg → temp PNG → cwebp → webp. Cleans up the temp PNG on success/failure. */
async function generatePoster(src, webpOut) {
    const tmpPng = webpOut.replace(/\.webp$/, ".tmp.png");
    try {
        await exec("ffmpeg", POSTER_FRAME_ARGS(src, tmpPng));
        await exec("cwebp", POSTER_WEBP_ARGS(tmpPng, webpOut));
    } finally {
        try {
            await fs.unlink(tmpPng);
        } catch {
            /* best-effort cleanup */
        }
    }
}

async function exists(p) {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

/** True if `out` exists AND is newer than `src` — i.e. nothing to do. */
async function isUpToDate(src, out) {
    if (!(await exists(out))) return false;
    const [srcStat, outStat] = await Promise.all([fs.stat(src), fs.stat(out)]);
    return outStat.mtimeMs >= srcStat.mtimeMs;
}

function humanSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/*  Main                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
    const [ffmpegOk, cwebpOk] = await Promise.all([
        hasTool("ffmpeg"),
        hasTool("cwebp"),
    ]);
    if (!ffmpegOk || !cwebpOk) {
        const missing = [
            !ffmpegOk && "ffmpeg",
            !cwebpOk && "cwebp",
        ].filter(Boolean);
        console.warn(
            `optimize-carousel-assets: missing tool(s) — ${missing.join(", ")}. Skipping.\n` +
                "    Install (macOS):  brew install ffmpeg webp",
        );
        process.exit(0);
    }

    if (!(await exists(SRC_DIR))) {
        console.error(`optimize-carousel-assets: source dir missing — ${SRC_DIR}`);
        process.exit(1);
    }

    await fs.mkdir(WEB_DIR, { recursive: true });
    await fs.mkdir(POSTER_DIR, { recursive: true });

    const entries = await fs.readdir(SRC_DIR);
    const sourceClips = entries.filter((f) => VIDEO_EXT.test(f)).sort();

    if (sourceClips.length === 0) {
        console.log("optimize-carousel-assets: no source clips found");
        return;
    }

    let processed = 0;
    let skipped = 0;
    let totalSrc = 0;
    let totalWeb = 0;

    for (const file of sourceClips) {
        const src = path.join(SRC_DIR, file);
        const stem = file.replace(VIDEO_EXT, "");
        const webOut = path.join(WEB_DIR, `${stem}.mp4`);
        const posterOut = path.join(POSTER_DIR, `${stem}.webp`);

        const [webDone, posterDone] = await Promise.all([
            isUpToDate(src, webOut),
            isUpToDate(src, posterOut),
        ]);

        if (webDone && posterDone) {
            skipped++;
            continue;
        }

        const tasks = [];
        if (!posterDone) tasks.push(generatePoster(src, posterOut));
        if (!webDone) tasks.push(exec("ffmpeg", WEB_ARGS(src, webOut)));

        process.stdout.write(`  ${file} … `);
        try {
            await Promise.all(tasks);
        } catch (err) {
            console.log("FAILED");
            console.error(err.stderr ?? err);
            process.exit(1);
        }

        const [srcSize, webSize] = await Promise.all([
            fs.stat(src).then((s) => s.size),
            fs.stat(webOut).then((s) => s.size),
        ]);
        totalSrc += srcSize;
        totalWeb += webSize;

        console.log(
            `${humanSize(srcSize)} → ${humanSize(webSize)} (${Math.round(
                (1 - webSize / srcSize) * 100,
            )}% smaller) + poster`,
        );
        processed++;
    }

    if (processed > 0) {
        console.log(
            `\noptimize-carousel-assets: ${processed} processed, ${skipped} up-to-date.\n` +
                `  Total ${humanSize(totalSrc)} → ${humanSize(totalWeb)} ` +
                `(${Math.round((1 - totalWeb / totalSrc) * 100)}% smaller across processed clips).`,
        );
    } else {
        console.log(`optimize-carousel-assets: ${skipped} up-to-date, nothing to do`);
    }
}

main().catch((err) => {
    console.error("optimize-carousel-assets:", err);
    process.exit(1);
});
