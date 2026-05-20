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
// OpenNext's externalImport helper has changed its pattern across versions.
// We match both the switch-case form (older) and the ternary form (newer).
const VERCEL_OG_PATCHES = [
    {
        // Older OpenNext: switch-case form
        pattern:
            /case"next\/dist\/compiled\/@vercel\/og\/index\.node\.js":\s*[A-Za-z_$][\w$]*\s*=\s*await\s+import\("next\/dist\/compiled\/@vercel\/og\/index\.edge\.js"\)\s*;?/g,
        replacement:
            'case"next/dist/compiled/@vercel/og/index.node.js":throw new Error("@vercel/og is not used in this app");',
    },
    {
        // Newer OpenNext: ternary form — matches regardless of variable names.
        // e.g.: lt==="next/dist/.../index.node.js"?Ce=await import("next/dist/.../index.edge.js"):Ce=await import(lt)
        pattern:
            /[A-Za-z_$][\w$]*==="next\/dist\/compiled\/@vercel\/og\/index\.node\.js"\?[A-Za-z_$][\w$]*=await import\("next\/dist\/compiled\/@vercel\/og\/index\.edge\.js"\):/g,
        replacement:
            '(void 0)===("next/dist/compiled/@vercel/og/index.node.js")?((()=>{throw new Error("@vercel/og is not used in this app")})(),undefined):',
    },
];

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

    for (const { pattern, replacement } of VERCEL_OG_PATCHES) {
        const matches = src.match(pattern);
        if (matches) {
            src = src.replace(pattern, replacement);
            console.log(
                `[patch]  ${relPath}: stripped ${matches.length} dead @vercel/og import(s)`,
            );
        }
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
        // keepNames is critical: Better Auth's email-OTP plugin (and
        // other Better Auth internals) resolve handlers by `fn.name`
        // / class name at runtime. Stripping those names breaks auth
        // routing — OTP-send returns the wrong handler and silently
        // no-ops. Tradeoff: slightly larger bundle for a reliable auth.
        keepNames: true,
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
