/**
 * GET /api/health
 *
 * Lightweight health check endpoint for deployment monitoring.
 * Verifies that the Worker is responding and D1 is reachable.
 * No authentication required — must be fast and publicly accessible
 * for uptime monitors (UptimeRobot, Cloudflare Health Checks, etc.).
 */

import { getDb } from "@/lib/db";

export async function GET(): Promise<Response> {
    const start = Date.now();

    try {
        const db = await getDb();
        await db.prepare("SELECT 1").first();

        return Response.json({
            status: "ok",
            latency: Date.now() - start,
        });
    } catch {
        return Response.json(
            { status: "degraded", error: "D1 unreachable" },
            { status: 503 },
        );
    }
}
