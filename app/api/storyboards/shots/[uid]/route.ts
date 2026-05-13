/**
 * /api/storyboards/shots/[uid] — shot mutations.
 *
 *   PATCH  — partial update (any of: prompt, action, dialogue,
 *            durationMs, notes, shotType, cameraMove, transition).
 *   DELETE — remove the shot; closes the positional gap.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import {
    deleteShot,
    StoryboardNotFoundError,
    updateShot,
} from "@/lib/storyboards";

type RouteContext = { params: Promise<{ uid: string }> };

const optionalText = z
    .string()
    .max(5000)
    .nullable()
    .optional()
    .transform((v) => {
        if (v === undefined) return undefined;
        if (v === null) return null;
        const t = v.trim();
        return t.length === 0 ? null : t;
    });

const PatchSchema = z.object({
    prompt: optionalText,
    action: optionalText,
    dialogue: optionalText,
    notes: optionalText,
    shotType: optionalText,
    cameraMove: optionalText,
    transition: optionalText,
    // Duration in milliseconds. Capped at 10 minutes per shot — well
    // beyond any realistic single shot, but a sane upper bound so a
    // malformed input doesn't store an absurd value.
    durationMs: z.number().int().min(0).max(10 * 60 * 1000).optional(),
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
        await updateShot(uid, session.user.id, input);
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
        await deleteShot(uid, session.user.id);
        return NextResponse.json({ ok: true });
    } catch (err) {
        if (err instanceof StoryboardNotFoundError) {
            return NextResponse.json({ error: err.message }, { status: 404 });
        }
        throw err;
    }
}
