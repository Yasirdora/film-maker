/**
 * /api/storyboards/[uid] — top-level storyboard mutations.
 *
 *   PATCH — rename the storyboard.
 *
 * All routes guard ownership inside `lib/storyboards` and surface
 * `StoryboardNotFoundError` as 404. Validation lives in Zod schemas at
 * the top of each route file so the shapes co-locate with the handler.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import { renameStoryboard, StoryboardNotFoundError } from "@/lib/storyboards";

type RouteContext = { params: Promise<{ uid: string }> };

const RenameSchema = z.object({
    title: z.string().trim().min(1).max(200),
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

    let input: z.infer<typeof RenameSchema>;
    try {
        const body = await request.json();
        input = RenameSchema.parse(body);
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof z.ZodError ? err.issues : "Invalid body" },
            { status: 400 },
        );
    }

    try {
        await renameStoryboard(uid, session.user.id, input.title);
        return NextResponse.json({ ok: true });
    } catch (err) {
        if (err instanceof StoryboardNotFoundError) {
            return NextResponse.json({ error: err.message }, { status: 404 });
        }
        throw err;
    }
}
