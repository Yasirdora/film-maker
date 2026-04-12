/**
 * POST /api/projects/[uid]/restore
 *
 * Restores an archived project, making it active again.
 */

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import { restoreProject } from "@/lib/projects";

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

    const restored = await restoreProject(uid, session.user.id);
    if (!restored) {
        return NextResponse.json(
            { error: "Project not found or not archived" },
            { status: 404 },
        );
    }

    return NextResponse.json({ ok: true });
}
