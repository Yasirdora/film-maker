/**
 * /api/projects/[uid] — individual project endpoints.
 *
 *   GET    — project detail (with recent generations).
 *   PATCH  — rename / update description / set cover.
 *   DELETE — soft-archive the project.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import {
    getProject,
    updateProject,
    archiveProject,
    MAX_PROJECT_NAME_LENGTH,
    MAX_PROJECT_DESCRIPTION_LENGTH,
} from "@/lib/projects";
import { logAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ uid: string }> };

// ─── GET /api/projects/[uid] ───────────────────────────────────────────────

export async function GET(
    _request: Request,
    { params }: RouteContext,
): Promise<Response> {
    const { uid } = await params;

    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await getProject(uid, session.user.id);
    if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
}

// ─── PATCH /api/projects/[uid] ─────────────────────────────────────────────

const UpdateSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1)
        .max(MAX_PROJECT_NAME_LENGTH)
        .optional(),
    description: z
        .string()
        .trim()
        .max(MAX_PROJECT_DESCRIPTION_LENGTH)
        .optional(),
    coverGenerationId: z.number().int().positive().nullable().optional(),
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

    let input: z.infer<typeof UpdateSchema>;
    try {
        const body = await request.json();
        input = UpdateSchema.parse(body);
    } catch (err) {
        const message =
            err instanceof z.ZodError
                ? err.issues.map((i) => i.message).join("; ")
                : "Invalid request body";
        return NextResponse.json({ error: message }, { status: 400 });
    }

    const updated = await updateProject(uid, session.user.id, input);
    if (!updated) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
}

// ─── DELETE /api/projects/[uid] ────────────────────────────────────────────

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

    const archived = await archiveProject(uid, session.user.id);
    if (!archived) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await logAudit({
        userId: session.user.id,
        action: "project.archive",
        targetType: "project",
        targetId: uid,
        ip: request.headers.get("cf-connecting-ip"),
    });

    return NextResponse.json({ ok: true });
}
