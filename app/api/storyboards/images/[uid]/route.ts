/**
 * /api/storyboards/images/[uid] — single shot-image actions.
 *
 *   DELETE  — remove the image (and its R2 object). If it was the
 *             selected variant, the next most-recent image is
 *             promoted; returns the new selection's UID.
 *
 *   PATCH { selected: true } — mark this image as the selected
 *             variant for its shot.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import {
    deleteShotImage,
    selectShotImage,
    StoryboardNotFoundError,
} from "@/lib/storyboards";

type RouteContext = { params: Promise<{ uid: string }> };

const PatchSchema = z.object({
    selected: z.literal(true).optional(),
});

export async function PATCH(
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

    let input: z.infer<typeof PatchSchema>;
    try {
        const body = await request.json();
        input = PatchSchema.parse(body);
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof z.ZodError ? err.issues : "Invalid body" },
            { status: 400 },
        );
    }

    if (!input.selected) {
        // Reserved for future fields (e.g. caption, alt text). Treat an
        // empty payload as a no-op rather than a 400 so clients can
        // safely batch this with optimistic updates.
        return NextResponse.json({ ok: true });
    }

    try {
        await selectShotImage(uid, session.user.id);
        return NextResponse.json({ ok: true });
    } catch (err) {
        if (err instanceof StoryboardNotFoundError) {
            return NextResponse.json({ error: err.message }, { status: 404 });
        }
        throw err;
    }
}

export async function DELETE(
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
        const result = await deleteShotImage(uid, session.user.id);
        return NextResponse.json({ ok: true, ...result });
    } catch (err) {
        if (err instanceof StoryboardNotFoundError) {
            return NextResponse.json({ error: err.message }, { status: 404 });
        }
        throw err;
    }
}
