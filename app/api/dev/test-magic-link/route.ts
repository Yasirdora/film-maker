/**
 * Dev-only diagnostic — calls Better Auth's magic-link sign-in endpoint
 * programmatically so any thrown error surfaces in the response body
 * instead of being swallowed by Better Auth's internal 500 wrapper.
 */

import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";

export async function GET(request: Request): Promise<Response> {
    if (process.env.NODE_ENV === "production") {
        return new Response("Not found", { status: 404 });
    }

    const to =
        new URL(request.url).searchParams.get("to") ??
        process.env.GMAIL_SENDER ??
        "";

    if (!to) {
        return NextResponse.json({ error: "No recipient" }, { status: 400 });
    }

    try {
        const auth = await getAuth();
        const result = await auth.api.signInMagicLink({
            body: { email: to, callbackURL: "/dashboard" },
            headers: request.headers,
        });
        return NextResponse.json({ ok: true, result });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        // Dump EVERYTHING — shape, cause chain, own props
        const dump = dumpError(err);
        console.error("[api/dev/test-magic-link] error:", err);
        return NextResponse.json(
            { ok: false, error: message, stack, dump },
            { status: 500 },
        );
    }
}

function dumpError(err: unknown, depth = 0): unknown {
    if (depth > 5) return "[max depth]";
    if (err === null || err === undefined) return err;
    if (typeof err !== "object") return err;
    const obj: Record<string, unknown> = {};
    for (const key of Object.getOwnPropertyNames(err)) {
        const value = (err as Record<string, unknown>)[key];
        if (value instanceof Error) {
            obj[key] = dumpError(value, depth + 1);
        } else {
            obj[key] = value;
        }
    }
    return obj;
}
