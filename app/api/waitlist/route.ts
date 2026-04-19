/**
 * POST /api/waitlist
 *
 * Adds an email to the waitlist. Accepts two modes:
 *
 *   • Authenticated — an active session infers the email; the body only
 *     needs a Turnstile token. Used by the post-sign-in waitlist card.
 *
 *   • Anonymous — the body carries `{ email, turnstileToken }`. Used by
 *     the landing announcement banner before a user has signed in.
 *
 * Both paths share the same table, the same Turnstile gate, and the
 * same IP rate limit. Inserts are idempotent via `INSERT OR IGNORE`.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { verifyTurnstileToken, getClientIp } from "@/lib/turnstile";

const BodySchema = z.object({
    turnstileToken: z.string().optional(),
    email: z.string().email().max(254).optional(),
});

export async function POST(request: Request): Promise<Response> {
    const originError = validateOrigin(request);
    if (originError) return originError;

    let body: z.infer<typeof BodySchema>;
    try {
        const raw = await request.json();
        body = BodySchema.parse(raw);
    } catch {
        return NextResponse.json(
            { error: "Invalid request body." },
            { status: 400 },
        );
    }

    const ip = getClientIp(request);

    const turnstile = await verifyTurnstileToken(
        body.turnstileToken ?? null,
        ip,
    );
    if (!turnstile.success) {
        return NextResponse.json(
            { error: turnstile.error ?? "Verification failed." },
            { status: 403 },
        );
    }

    if (await checkIpRateLimit(ip, RATE_LIMITS.waitlist)) {
        return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            { status: 429 },
        );
    }

    const session = await getSession();
    const sessionEmail = session?.user?.email?.trim().toLowerCase();
    const bodyEmail = body.email?.trim().toLowerCase();
    const email = sessionEmail ?? bodyEmail;

    if (!email) {
        return NextResponse.json(
            { error: "An email is required." },
            { status: 400 },
        );
    }

    try {
        const db = await getDb();
        await db
            .prepare("INSERT OR IGNORE INTO waitlist (email) VALUES (?)")
            .bind(email)
            .run();
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json(
            { error: "Something went wrong. Please try again." },
            { status: 500 },
        );
    }
}
