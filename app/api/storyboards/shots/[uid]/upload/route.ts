/**
 * POST /api/storyboards/shots/[uid]/upload
 *
 * Multipart upload for storyboard shot images. The client converts to
 * WebP *before* upload (see `lib/storyboard-webp.ts`); this endpoint
 * validates dimensions + size, writes the bytes to R2, and creates the
 * `storyboard_shot_image` row.
 *
 * We deliberately keep server-side image processing minimal — no
 * format transcoding, no resizing — because the worker CPU budget is
 * limited and the client has already produced a WebP at sensible
 * dimensions. The server only enforces hard caps so an adversarial
 * client can't blow the bucket.
 *
 * Caps (Slice 2a):
 *   • Max file size: 8 MB (well above typical 200–500 KB WebP output).
 *   • Max dimensions: 4096 × 4096 (storyboards never need more).
 *   • Allowed MIME (declared): image/webp.
 *   • Allowed original MIME (audit only): jpeg/png/webp/heic/heif —
 *     stored on the row for forensics, not validated server-side.
 */

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import { getR2 } from "@/lib/db";
import { getProject } from "@/lib/projects";
import {
    buildStoryboardImageR2Key,
    createUploadedImage,
    StoryboardNotFoundError,
} from "@/lib/storyboards";
import { generateUid } from "@/lib/utils";
import { getDb } from "@/lib/db";

type RouteContext = { params: Promise<{ uid: string }> };

const MAX_BYTES = 8 * 1024 * 1024;        //  8 MB
const MAX_DIMENSION = 4096;               //  px on either axis

export async function POST(
    request: Request,
    { params }: RouteContext,
): Promise<Response> {
    const originError = validateOrigin(request);
    if (originError) return originError;

    const { uid: shotUid } = await params;

    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    let form: FormData;
    try {
        form = await request.formData();
    } catch {
        return NextResponse.json(
            { error: "Expected multipart form-data" },
            { status: 400 },
        );
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
        return NextResponse.json(
            { error: "Missing `file` field" },
            { status: 400 },
        );
    }
    if (file.size === 0) {
        return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json(
            { error: `File exceeds ${MAX_BYTES / 1024 / 1024} MB limit` },
            { status: 413 },
        );
    }
    if (file.type !== "image/webp") {
        return NextResponse.json(
            { error: "Only WebP is accepted. Convert client-side before upload." },
            { status: 415 },
        );
    }

    // Dimensions + origin MIME are sent as additional form fields by the
    // client (it already decoded the source to a Canvas, so it knows).
    // We trust them up to the MAX_DIMENSION cap — they're advisory and
    // only affect the variant-tray layout.
    const widthStr = form.get("width");
    const heightStr = form.get("height");
    const originMime = String(form.get("originMime") ?? "image/webp");

    const width = Number.parseInt(String(widthStr ?? ""), 10);
    const height = Number.parseInt(String(heightStr ?? ""), 10);
    if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
    ) {
        return NextResponse.json(
            { error: "Invalid width/height" },
            { status: 400 },
        );
    }
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        return NextResponse.json(
            { error: `Dimensions exceed ${MAX_DIMENSION}px cap` },
            { status: 413 },
        );
    }

    // We need the project's UID to build the R2 key, but the URL only
    // carries the shot UID. Look it up via shot → scene → storyboard →
    // project. Ownership is enforced by `createUploadedImage`'s guard;
    // this query just gathers the path-building bits.
    const db = await getDb();
    const ctx = await db
        .prepare(
            `SELECT p.uid AS project_uid, up.uid AS user_uid
               FROM storyboard_shot sh
               JOIN storyboard_scene sc ON sc.id = sh.scene_id
               JOIN storyboard b ON b.id = sc.storyboard_id
               JOIN project p ON p.id = b.project_id
               LEFT JOIN user_profile up ON up.user_id = b.user_id
              WHERE sh.uid = ? AND b.user_id = ?
              LIMIT 1`,
        )
        .bind(shotUid, userId)
        .first<{ project_uid: string; user_uid: string | null }>();
    if (!ctx) {
        return NextResponse.json({ error: "Shot not found" }, { status: 404 });
    }

    // Confirm the parent project still exists + isn't archived. We
    // could trust the shot row alone (FKs enforce existence), but
    // `getProject` also rejects archived projects.
    const project = await getProject(ctx.project_uid, userId);
    if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    // Fall back to the user_id when no user_profile row exists yet —
    // matches the generation pipeline's behaviour.
    const userUid = ctx.user_uid ?? userId;

    const imageUid = generateUid(16);
    const r2Key = buildStoryboardImageR2Key(
        userUid,
        project.uid,
        shotUid,
        imageUid,
    );

    // Stream the bytes through to R2. `file.arrayBuffer()` is fine at
    // 8 MB — Cloudflare Workers handle a single 8 MB allocation
    // comfortably; for the eventual chunked-upload path (Slice 5) we
    // can switch to `file.stream()` + presigned PUT.
    const bytes = await file.arrayBuffer();

    try {
        const r2 = await getR2();
        await r2.put(r2Key, bytes, {
            httpMetadata: { contentType: "image/webp" },
        });
    } catch (err) {
        console.error("[storyboards/upload] R2 put failed", r2Key, err);
        return NextResponse.json(
            { error: "Storage upload failed" },
            { status: 502 },
        );
    }

    try {
        const image = await createUploadedImage({
            shotUid,
            userId,
            imageUid,
            r2Key,
            width,
            height,
            bytes: file.size,
            originMime: originMime || "image/webp",
        });
        return NextResponse.json({ image });
    } catch (err) {
        // Roll back R2 if the DB insert failed so we don't leave orphan
        // objects. Best-effort.
        try {
            const r2 = await getR2();
            await r2.delete(r2Key);
        } catch (cleanupErr) {
            console.warn("[storyboards/upload] orphan cleanup failed", cleanupErr);
        }
        if (err instanceof StoryboardNotFoundError) {
            return NextResponse.json({ error: err.message }, { status: 404 });
        }
        throw err;
    }
}
