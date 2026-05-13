/**
 * /api/storyboards/scenes/[uid] — scene mutations.
 *
 *   PATCH  — partial update (slugline / action / notes).
 *   DELETE — remove the scene and close the positional gap.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import {
    deleteScene,
    StoryboardNotFoundError,
    updateScene,
} from "@/lib/storyboards";

type RouteContext = { params: Promise<{ uid: string }> };

// Nullable trimmed-string helper — empty string becomes `null` so the
// DB clears the field rather than storing a blank.
const optionalText = z
    .string()
    .max(2000)
    .nullable()
    .optional()
    .transform((v) => {
        if (v === undefined) return undefined;
        if (v === null) return null;
        const t = v.trim();
        return t.length === 0 ? null : t;
    });

const PatchSchema = z.object({
    slugline: optionalText,
    action: optionalText,
    notes: optionalText,
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

    try {
        await updateScene(uid, session.user.id, input);
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
        await deleteScene(uid, session.user.id);
        return NextResponse.json({ ok: true });
    } catch (err) {
        if (err instanceof StoryboardNotFoundError) {
            return NextResponse.json({ error: err.message }, { status: 404 });
        }
        throw err;
    }
}
