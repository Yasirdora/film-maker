/**
 * POST /api/projects/[uid]/pin
 *
 * Pins the project so it appears at the top of the user's studio list.
 * Idempotent: pinning an already-pinned project refreshes its
 * `pinned_at` timestamp, so repeat calls bubble it back to the top of
 * the pinned group.
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

    const updated = await pinProject(uid, session.user.id, true);
    if (!updated) {
        return NextResponse.json(
            { error: "Project not found" },
            { status: 404 },
        );
    }

    await logAudit({
        userId: session.user.id,
        action: "project.pin",
        targetType: "project",
        targetId: uid,
        ip: request.headers.get("cf-connecting-ip"),
    });

    return NextResponse.json({ ok: true });
}
