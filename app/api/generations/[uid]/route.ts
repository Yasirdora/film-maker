/**
 * GET  /api/generations/[uid]  — generation status poll
 * DELETE /api/generations/[uid] — permanent delete
 *
 * GET is used by the client-side polling fallback: when the original
 * generation request's HTTP response is lost (Cloudflare proxy timeout,
 * network interruption, etc.), the workspace polls this endpoint to
 * check whether the backend completed the generation. Lightweight — one
 * D1 read, no R2 access.
 *
 * DELETE permanently removes a generation. Returns 204 on success, 404
 * if the generation doesn't exist or isn't owned by the user.
 *
 * Notes:
 *   • Credit refunds are not issued on delete — the user had a successful
 *     generation and explicitly discarded it.
 *   • R2 blobs are left in place; background sweep is on the roadmap.
 */

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { getGeneration, deleteGeneration } from "@/lib/generations";

// ─── GET — status poll ─────────────────────────────────────────────────────

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ uid: string }> },
): Promise<Response> {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { uid } = await params;
    const generation = await getGeneration(uid, session.user.id);
    if (!generation) {
        return NextResponse.json(
            { error: "Generation not found" },
            { status: 404 },
        );
    }

    return NextResponse.json({
        uid: generation.uid,
        status: generation.status,
        kind: generation.kind,
        imageUrls: generation.outputUrls ?? [],
        creditCost: generation.creditCost,
        error: generation.errorMessage,
    });
}

// ─── DELETE — permanent remove ─────────────────────────────────────────────

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ uid: string }> },
): Promise<Response> {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { uid } = await params;
    const deleted = await deleteGeneration(uid, session.user.id);
    if (!deleted) {
        return NextResponse.json(
            { error: "Generation not found" },
            { status: 404 },
        );
    }

    return new Response(null, { status: 204 });
}
