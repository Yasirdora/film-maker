/**
 * POST /api/projects/[uid]/unpin
 *
 * Clears the project's pin so it falls back into the regular
 * recency-ordered section of the studio list. Idempotent.
 */

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import { pinProject } from "@/lib/projects";
import { logAudit } from "@/lib/audit";

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

    const updated = await pinProject(uid, session.user.id, false);
    if (!updated) {
        return NextResponse.json(
            { error: "Project not found" },
            { status: 404 },
        );
    }

    await logAudit({
        userId: session.user.id,
        action: "project.unpin",
        targetType: "project",
        targetId: uid,
        ip: request.headers.get("cf-connecting-ip"),
    });

    return NextResponse.json({ ok: true });
}
