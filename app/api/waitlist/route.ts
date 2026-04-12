import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";

export async function POST(request: Request): Promise<Response> {
    const originError = validateOrigin(request);
    if (originError) return originError;
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
