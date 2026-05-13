/**
 * /api/storyboards/scenes/[uid]/reorder — write the new shot ordering
 * for the destination scene.
 *
 *   POST { shotUids: string[] } — full new ordering of shots that
 *                                 should end up in this scene. Supports
 *                                 cross-scene moves: any shot UID owned
 *                                 by the user is repointed at this
 *                                 scene, and its previous scene gets
 *                                 compacted automatically.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import { reorderShots, StoryboardNotFoundError } from "@/lib/storyboards";

type RouteContext = { params: Promise<{ uid: string }> };

const Schema = z.object({
    shotUids: z.array(z.string().min(1)).min(1).max(500),
});

export async function POST(
    request: Request,
    { params }: RouteContext,
): Promise<Response> {
    const originError = validateOrigin(request);
    if (originError) return originError;

    const { uid } = await params;

    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let input: z.infer<typeof Schema>;
    try {
        const body = await request.json();
        input = Schema.parse(body);
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof z.ZodError ? err.issues : "Invalid body" },
            { status: 400 },
        );
    }

    try {
        await reorderShots(uid, session.user.id, input.shotUids);
        return NextResponse.json({ ok: true });
    } catch (err) {
        if (err instanceof StoryboardNotFoundError) {
            return NextResponse.json({ error: err.message }, { status: 404 });
        }
        throw err;
    }
}
