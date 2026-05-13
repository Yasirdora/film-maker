/**
 * /api/storyboards/[uid]/reorder — rewrite scene positions.
 *
 *   POST { sceneUids: string[] } — full new ordering. Unknown UIDs
 *                                  are silently dropped (stale client
 *                                  defense; see `reorderScenes`).
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import { reorderScenes, StoryboardNotFoundError } from "@/lib/storyboards";

type RouteContext = { params: Promise<{ uid: string }> };

const Schema = z.object({
    sceneUids: z.array(z.string().min(1)).max(500),
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
        await reorderScenes(uid, session.user.id, input.sceneUids);
        return NextResponse.json({ ok: true });
    } catch (err) {
        if (err instanceof StoryboardNotFoundError) {
            return NextResponse.json({ error: err.message }, { status: 404 });
        }
        throw err;
    }
}
