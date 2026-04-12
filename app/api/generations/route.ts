/**
 * GET /api/generations
 *
 * Returns the authenticated user's recent image generations, newest
 * first. Used by the dashboard to display the generation gallery.
 *
 * Query params:
 *   limit  — number of results (default 20, max 100)
 *   offset — pagination offset (default 0)
 */

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { listGenerations } from "@/lib/generations";

export async function GET(request: Request): Promise<Response> {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = Math.min(
        Math.max(1, Number(url.searchParams.get("limit")) || 20),
        100,
    );
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

    const generations = await listGenerations(session.user.id, limit, offset);

    return NextResponse.json({ generations });
}
