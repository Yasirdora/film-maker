#!/usr/bin/env node
// Post-build pass over OpenNext's output. Does two things:
//
//  1. Strips the dead `@vercel/og` import. OpenNext's `externalImport`
//     helper contains a hardcoded `import("…@vercel/og/index.edge.js")`
//     used by Next.js's `ImageResponse`. This app never calls
//     `ImageResponse`, so the import is unreachable at runtime — but
//     Wrangler sees the literal string and eagerly bundles ~1.4 MiB of
//     wasm + JS for nothing. Rewriting the call site to throw removes
//     the reference and the bundled files with it.
//
//  2. Minifies the bundle. OpenNext disables minification during build
//     so it can string-patch afterward; by the time this script runs,
//     all patches have been applied and it's safe to minify. This
//     shrinks the Worker enough to fit inside Cloudflare's 3 MiB free
//     / 10 MiB paid size limits.

import { build } from "esbuild";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const TARGETS = [
    ".open-next/server-functions/default/handler.mjs",
    ".open-next/middleware/handler.mjs",
    ".open-next/worker.js",
];

// Pattern match: OpenNext emits this exact case-branch. Replacing the
// `import(...)` expression with a throw keeps the switch's control flow
// intact (TDZ-safe, no shape change) while removing the dead reference.
const VERCEL_OG_PATCH = {
    // Matches the OpenNext `externalImport` case-branch regardless of
    // the minified variable name (raw, qe, etc.) or whitespace.
    pattern:
        /case"next\/dist\/compiled\/@vercel\/og\/index\.node\.js":\s*[A-Za-z_$][\w$]*\s*=\s*await\s+import\("next\/dist\/compiled\/@vercel\/og\/index\.edge\.js"\)\s*;?/g,
    replacement:
        'case"next/dist/compiled/@vercel/og/index.node.js":throw new Error("@vercel/og is not used in this app");',
};

function human(bytes) {
    return (bytes / 1024 / 1024).toFixed(2) + " MiB";
}

for (const relPath of TARGETS) {
    const path = resolve(relPath);
    let before;
    try {
        before = statSync(path).size;
    } catch {
        console.log(`[minify] skip (missing): ${relPath}`);
        continue;
    }

    let src = readFileSync(path, "utf8");

    const matches = src.match(VERCEL_OG_PATCH.pattern);
    if (matches) {
        src = src.replace(VERCEL_OG_PATCH.pattern, VERCEL_OG_PATCH.replacement);
        console.log(
            `[patch]  ${relPath}: stripped ${matches.length} dead @vercel/og import(s)`,
        );
    }

    const result = await build({
        stdin: {
            contents: src,
            resolveDir: resolve(relPath, ".."),
            sourcefile: relPath,
            loader: "js",
        },
        bundle: false,
        minify: true,
        format: "esm",
        platform: "neutral",
        target: "es2022",
        write: false,
        legalComments: "none",
    });

    writeFileSync(path, result.outputFiles[0].contents);
    const after = statSync(path).size;
    console.log(
        `[minify] ${relPath}: ${human(before)} → ${human(after)} ` +
        `(${(((before - after) / before) * 100).toFixed(1)}% off)`,
    );
}
