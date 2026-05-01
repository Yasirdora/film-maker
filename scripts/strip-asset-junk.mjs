#!/usr/bin/env node
// Pre-deploy filter for the OpenNext assets bundle.
//
// OpenNext mirrors `public/` into `.open-next/assets/` verbatim before
// Wrangler uploads it. That means OS-level metadata files that drift
// into `public/` (.DS_Store from Finder, Thumbs.db from Explorer)
// silently get shipped to Cloudflare. They cost ~10 KB each — small,
// but they're noise on a CDN and clutter wrangler's "X new files"
// diff every deploy.
//
// We strip them at the staged-assets layer rather than from `public/`
// itself for two reasons:
//
//   1. `public/` is the source of truth — the repo doesn't get
//      mutated by the deploy pipeline.
//   2. This step catches junk regardless of where it originated
//      (Finder, an editor, a future build step), so the guarantee
//      is "no junk ever reaches Cloudflare," not "no junk ever
//      reaches `public/`."
//
// Only well-known platform metadata names are stripped — no globs, no
// "extension blacklists." If a filename ever becomes a real asset on
// some future platform, this script won't quietly delete it.

import { readdir, stat, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ASSETS_DIR = resolve(".open-next/assets");

// Exact filenames to strip. Conservative on purpose — adding a regex
// here would risk eating real assets on a typo.
const JUNK_FILENAMES = new Set([
    ".DS_Store",
    "Thumbs.db",
    "Thumbs.db:encryptable",
    "desktop.ini",
]);

// macOS resource-fork shadows produced by some `cp` and unzip flows.
// These always start with `._` and pair 1:1 with a real file. Match
// by prefix rather than putting a wildcard in the exact-match set.
const RESOURCE_FORK_PREFIX = "._";

function isJunk(name) {
    if (JUNK_FILENAMES.has(name)) return true;
    if (name.startsWith(RESOURCE_FORK_PREFIX)) return true;
    return false;
}

async function walk(dir, onFile) {
    const entries = await readdir(dir, { withFileTypes: true });
    await Promise.all(
        entries.map(async (entry) => {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(path, onFile);
            } else if (entry.isFile()) {
                await onFile(path, entry.name);
            }
        }),
    );
}

if (!existsSync(ASSETS_DIR)) {
    // OpenNext build hasn't run yet — nothing to do. The deploy chain
    // wires this script between `opennextjs-cloudflare build` and the
    // wrangler upload, so reaching this branch implies a misconfigured
    // pipeline (or a developer running the script standalone).
    console.log(
        `[strip-asset-junk] skip: ${relative(process.cwd(), ASSETS_DIR)} does not exist`,
    );
    process.exit(0);
}

const removed = [];
let bytesFreed = 0;

await walk(ASSETS_DIR, async (path, name) => {
    if (!isJunk(name)) return;
    const { size } = await stat(path);
    await unlink(path);
    removed.push(relative(ASSETS_DIR, path));
    bytesFreed += size;
});

if (removed.length === 0) {
    console.log("[strip-asset-junk] clean — no junk files in assets bundle");
} else {
    const human = `${(bytesFreed / 1024).toFixed(1)} KB`;
    console.log(
        `[strip-asset-junk] removed ${removed.length} file(s), freed ${human}:`,
    );
    for (const path of removed) console.log(`  - ${path}`);
}
