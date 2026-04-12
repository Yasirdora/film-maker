/**
 * Dev-only diagnostic route — sends a test email directly via the
 * Gmail REST API pipeline, bypassing Better Auth entirely. Isolates
 * whether the bug is in lib/email.ts or in Better Auth's plugin glue.
 *
 * Hard-gated to NODE_ENV !== 'production'. Even though the route would
 * be harmless in prod, we don't want dev diagnostics surfaced there.
 *
 * Usage:
 *   curl 'http://localhost:3000/api/dev/test-email?to=you@example.com'
 */

import { NextResponse } from "next/server";
import { sendVerificationEmail } from "@/lib/email";

export async function GET(request: Request): Promise<Response> {
    if (process.env.NODE_ENV === "production") {
        return new Response("Not found", { status: 404 });
    }

    const to =
        new URL(request.url).searchParams.get("to") ??
        process.env.GMAIL_SENDER ??
        "";

    if (!to) {
        return NextResponse.json(
            { error: "No recipient. Pass ?to=email or set GMAIL_SENDER." },
            { status: 400 },
        );
    }

    // Check env var presence without leaking values.
    const envStatus = {
        GMAIL_CLIENT_ID: Boolean(process.env.GMAIL_CLIENT_ID),
        GMAIL_CLIENT_SECRET: Boolean(process.env.GMAIL_CLIENT_SECRET),
        GMAIL_REFRESH_TOKEN: Boolean(process.env.GMAIL_REFRESH_TOKEN),
        GMAIL_SENDER: process.env.GMAIL_SENDER ?? null,
        NODE_ENV: process.env.NODE_ENV ?? null,
        NEXT_RUNTIME: process.env.NEXT_RUNTIME ?? null,
    };

    try {
        await sendVerificationEmail({
            email: to,
            code: "123456",
            url: "https://film-maker.net/__dev_test__",
        });
        return NextResponse.json({ ok: true, sentTo: to, envStatus });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        console.error("[api/dev/test-email] error:", err);
        return NextResponse.json(
            { ok: false, error: message, stack, envStatus },
            { status: 500 },
        );
    }
}
