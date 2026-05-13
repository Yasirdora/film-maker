/**
 * /api/storyboards/[uid]/scenes — scene collection under a storyboard.
 *
 *   POST — append a new (empty) scene. Returns the created `Scene`
 *          so the client can render it without a refetch.
 */

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import { addScene, StoryboardNotFoundError } from "@/lib/storyboards";

type RouteContext = { params: Promise<{ uid: string }> };

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

    try {
        const scene = await addScene(uid, session.user.id);
        return NextResponse.json({ scene });
    } catch (err) {
        if (err instanceof StoryboardNotFoundError) {
            return NextResponse.json({ error: err.message }, { status: 404 });
        }
        throw err;
    }
}
