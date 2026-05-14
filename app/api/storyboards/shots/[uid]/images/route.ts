/**
 * GET /api/storyboards/shots/[uid]/images
 *
 * Returns every image attached to a shot. Used by the variant tray on
 * open — the board-list query only carries the selected image, so the
 * tray fetches the rest on demand.
 */

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { getShotImages, StoryboardNotFoundError } from "@/lib/storyboards";

type RouteContext = { params: Promise<{ uid: string }> };

export async function GET(
    _request: Request,
    { params }: RouteContext,
): Promise<Response> {
    const { uid } = await params;

    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const images = await getShotImages(uid, session.user.id);
        return NextResponse.json({ images });
    } catch (err) {
        if (err instanceof StoryboardNotFoundError) {
            return NextResponse.json({ error: err.message }, { status: 404 });
        }
        throw err;
    }
}
