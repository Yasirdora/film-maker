/**
 * GET /api/storage/[...key]
 *
 * R2 object proxy. In development, miniflare's local R2 has no HTTP
 * endpoint, so this route reads from the R2 binding and streams the
 * object back. In production, image URLs point to the R2 custom domain
 * (storage.film-maker.net) so this route is not hit in normal flow.
 *
 * The route is deployed to production as a fallback — if the R2 custom
 * domain is misconfigured, images can still be served through here.
 * Objects are immutable (generated images never change), so we set
 * aggressive cache headers.
 */

import { NextResponse } from "next/server";
import { getR2 } from "@/lib/db";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ key: string[] }> },
): Promise<Response> {
    const { key } = await params;
    const objectKey = key.join("/");

    // Basic path traversal guard — reject keys with ".." segments.
    if (key.some((segment) => segment === "..")) {
        return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }

    try {
        const r2 = await getR2();
        const object = await r2.get(objectKey);

        if (!object) {
            return NextResponse.json(
                { error: "Not found" },
                { status: 404 },
            );
        }

        const headers = new Headers();
        headers.set(
            "Content-Type",
            (object as unknown as { httpMetadata?: { contentType?: string } })
                .httpMetadata?.contentType ?? "image/png",
        );
        // Generated images are immutable — cache aggressively.
        headers.set("Cache-Control", "public, max-age=31536000, immutable");

        return new Response(object.body as ReadableStream, { headers });
    } catch (err) {
        console.error("[api/storage] R2 read error:", err);
        return NextResponse.json(
            { error: "Failed to read object" },
            { status: 500 },
        );
    }
}
