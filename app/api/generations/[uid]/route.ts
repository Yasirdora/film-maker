/**
 * DELETE /api/generations/[uid]
 *
 * Permanently deletes a generation owned by the authenticated user.
 * Returns 204 on success, 404 if the generation doesn't exist or isn't
 * owned by the user (same response either way — callers shouldn't be
 * able to distinguish "not yours" from "doesn't exist").
 *
 * Notes:
 *   • Credit refunds are not issued on delete — the user had a successful
 *     generation and explicitly discarded it.
 *   • R2 blobs are left in place; background sweep is on the roadmap.
 */

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { deleteGeneration } from "@/lib/generations";

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
