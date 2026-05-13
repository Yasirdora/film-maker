/**
 * /api/storyboards/scenes/[uid]/shots — shots inside a scene.
 *
 *   POST — append a new (empty) shot. Returns the created `Shot`.
 */

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import { addShot, StoryboardNotFoundError } from "@/lib/storyboards";

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
        const shot = await addShot(uid, session.user.id);
        return NextResponse.json({ shot });
    } catch (err) {
        if (err instanceof StoryboardNotFoundError) {
            return NextResponse.json({ error: err.message }, { status: 404 });
        }
        throw err;
    }
}
