/**
 * POST /api/auth/google/risc-event
 *
 * Google RISC (Risk and Incident Sharing) webhook — Cross-Account Protection.
 *
 * Google notifies this endpoint when a security event occurs on a user's
 * Google account (password change, account hijack, session revocation).
 * We respond by revoking the affected user's sessions immediately.
 *
 * Security:
 *   • Payload is a signed Security Event Token (SET) — a JWT signed with
 *     Google's private key. We verify it against Google's RISC JWKS before
 *     trusting any event data.
 *   • Audience check ensures the token was issued for this app's client ID.
 *   • Tokens older than 1 hour are rejected.
 *
 * Events handled:
 *   sessions-revoked                   → delete all sessions
 *   tokens-revoked                     → delete all sessions
 *   account-credential-change-required → delete all sessions (force re-auth)
 *   account-disabled                   → delete sessions + remove Google account link
 *   account-purged                     → delete sessions + remove Google account link
 *
 * Registration:
 *   Register this URL in Google Cloud Console → Security → RISC:
 *   https://your-domain.com/api/auth/google/risc-event
 */

import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const GOOGLE_ISSUER = "https://accounts.google.com";
const RISC_CONFIG_URL = "https://accounts.google.com/.well-known/risc/openid-configuration";

const RISC_SESSIONS_REVOKED =
    "https://schemas.openid.net/secevent/risc/event-type/sessions-revoked";
const RISC_TOKENS_REVOKED =
    "https://schemas.openid.net/secevent/risc/event-type/tokens-revoked";
const RISC_CREDENTIAL_CHANGE =
    "https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required";
const RISC_ACCOUNT_DISABLED =
    "https://schemas.openid.net/secevent/risc/event-type/account-disabled";
const RISC_ACCOUNT_PURGED =
    "https://schemas.openid.net/secevent/risc/event-type/account-purged";

// Module-level JWKS cache — persists for the lifetime of the worker isolate.
let jwksCache: { keys: RiscJwk[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour

interface RiscJwk {
    kid?: string;
    kty: string;
    alg?: string;
    use?: string;
    n?: string;
    e?: string;
    [key: string]: unknown;
}

async function fetchRiscJwks(): Promise<RiscJwk[]> {
    const now = Date.now();
    if (jwksCache && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
        return jwksCache.keys;
    }

    const configRes = await fetch(RISC_CONFIG_URL);
    if (!configRes.ok) throw new Error("Failed to fetch RISC OpenID config");
    const config = (await configRes.json()) as { jwks_uri: string };

    const jwksRes = await fetch(config.jwks_uri);
    if (!jwksRes.ok) throw new Error("Failed to fetch RISC JWKS");
    const jwks = (await jwksRes.json()) as { keys: RiscJwk[] };

    jwksCache = { keys: jwks.keys, fetchedAt: now };
    return jwks.keys;
}

function base64UrlDecode(input: string): string {
    return atob(input.replace(/-/g, "+").replace(/_/g, "/"));
}

function base64UrlToBytes(input: string): Uint8Array {
    return Uint8Array.from(base64UrlDecode(input), (c) => c.charCodeAt(0));
}

interface RiscEventSubject {
    subject_type: string;
    iss?: string;
    sub: string;
}

interface RiscPayload {
    iss: string;
    aud: string;
    iat: number;
    jti?: string;
    events: Record<string, { subject: RiscEventSubject }>;
}

async function verifyRiscJwt(token: string): Promise<RiscPayload> {
    const parts = token.trim().split(".");
    if (parts.length !== 3) throw new Error("Malformed JWT");

    const [headerB64, payloadB64, signatureB64] = parts;

    const header = JSON.parse(base64UrlDecode(headerB64)) as {
        kid?: string;
        alg?: string;
    };
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as RiscPayload;

    if (payload.iss !== GOOGLE_ISSUER) throw new Error("Invalid issuer");

    const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
    if (payload.aud !== clientId) throw new Error("Invalid audience");

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds - payload.iat > 3600) throw new Error("Token expired");

    const keys = await fetchRiscJwks();
    const jwk = header.kid ? keys.find((k) => k.kid === header.kid) : keys[0];
    if (!jwk) throw new Error("No matching signing key");

    const cryptoKey = await crypto.subtle.importKey(
        "jwk",
        jwk as JsonWebKey,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
    );

    const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlToBytes(signatureB64);

    const valid = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        signature.buffer as ArrayBuffer,
        signedData,
    );

    if (!valid) throw new Error("Invalid JWT signature");

    return payload;
}

export async function POST(request: Request): Promise<Response> {
    const token = await request.text().catch(() => "");
    if (!token) return new Response("Empty body", { status: 400 });

    let payload: RiscPayload;
    try {
        payload = await verifyRiscJwt(token);
    } catch (err) {
        console.error("[risc] JWT verification failed:", err);
        return new Response("Unauthorized", { status: 401 });
    }

    const events = payload.events;
    const eventType = Object.keys(events ?? {})[0];
    const googleSub = events?.[eventType]?.subject?.sub;

    if (!eventType || !googleSub) {
        return new Response("Invalid event payload", { status: 400 });
    }

    const db = await getDb();

    const accountRow = await db
        .prepare(
            "SELECT user_id FROM account WHERE provider_id = 'google' AND account_id = ? LIMIT 1",
        )
        .bind(googleSub)
        .first<{ user_id: string }>();

    if (!accountRow) {
        // Unknown user — acknowledge so Google stops retrying.
        return new Response(null, { status: 202 });
    }

    const userId = accountRow.user_id;

    switch (eventType) {
        case RISC_SESSIONS_REVOKED:
        case RISC_TOKENS_REVOKED:
        case RISC_CREDENTIAL_CHANGE: {
            await db
                .prepare("DELETE FROM session WHERE user_id = ?")
                .bind(userId)
                .run();

            await logAudit({
                userId,
                action: "user.logout",
                targetType: "user",
                targetId: userId,
                metadata: { reason: "risc_event", eventType },
            });
            break;
        }

        case RISC_ACCOUNT_DISABLED:
        case RISC_ACCOUNT_PURGED: {
            await db.batch([
                db.prepare("DELETE FROM session WHERE user_id = ?").bind(userId),
                db
                    .prepare(
                        "DELETE FROM account WHERE user_id = ? AND provider_id = 'google'",
                    )
                    .bind(userId),
            ]);

            await logAudit({
                userId,
                action: "user.logout",
                targetType: "user",
                targetId: userId,
                metadata: { reason: "risc_event", eventType },
            });
            break;
        }

        default:
            // Unknown event type — acknowledge and move on.
            break;
    }

    return new Response(null, { status: 202 });
}
