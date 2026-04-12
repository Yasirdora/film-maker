import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: Request): Promise<Response> {
    const originError = validateOrigin(request);
    if (originError) return originError;

    // IP rate limit — prevent spam signups.
    const ip =
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for") ??
        null;
    if (await checkIpRateLimit(ip, RATE_LIMITS.waitlist)) {
        return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            { status: 429 },
        );
    }

    const session = await getSession();
    if (!session?.user?.email) {
        return NextResponse.json(
            { error: "You must be signed in." },
            { status: 401 },
        );
    }

    const email = session.user.email.trim().toLowerCase();

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
