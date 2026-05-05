/**
 * Google Cloud service-account authentication for Vertex AI.
 *
 * Vertex AI doesn't accept static API keys — every request needs a short-lived
 * OAuth 2.0 access token derived from a service account's private key. The
 * standard `google-auth-library` depends on Node crypto and won't run on
 * Cloudflare Workers, so this module mints tokens directly using the
 * Web Crypto API (`crypto.subtle`), which is available on both Node ≥18
 * and the Workers runtime.
 *
 * Flow per token refresh:
 *   1. Build a JWT claim set asking for the cloud-platform scope.
 *   2. Sign it with the service account's RSA private key (RS256).
 *   3. POST it to Google's OAuth token endpoint as a `urn:ietf:params:
 *      oauth:grant-type:jwt-bearer` assertion.
 *   4. Cache the returned access token in memory until 5 minutes before
 *      it expires.
 *
 * The cache is per-isolate, which is exactly what we want — each Worker
 * isolate or Node process pays the JWT cost once per hour.
 */
import { base64ToBytes, bytesToBase64Url } from "./base64";

// ─── Configuration ──────────────────────────────────────────────────────────

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const TOKEN_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const TOKEN_LIFETIME_SECONDS = 3600;
/** Refresh a few minutes before expiry so in-flight requests don't 401. */
const TOKEN_REFRESH_BUFFER_SECONDS = 300;
const DEFAULT_LOCATION = "us-central1";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ServiceAccountCredentials {
    clientEmail: string;
    privateKey: string;
    projectId: string;
}

interface CachedToken {
    accessToken: string;
    /** Unix epoch seconds. */
    expiresAt: number;
}

// ─── Module state ───────────────────────────────────────────────────────────

let cachedCredentials: ServiceAccountCredentials | null = null;
let cachedKey: CryptoKey | null = null;
let cachedToken: CachedToken | null = null;
/**
 * In-flight token fetches are deduped so concurrent callers (e.g. a burst of
 * parallel image generations) all wait on the same OAuth round-trip.
 */
let inFlightTokenFetch: Promise<string> | null = null;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns the active service account credentials. Throws if the
 * `GOOGLE_SERVICE_ACCOUNT_JSON` env var is missing or malformed.
 */
export function getServiceAccount(): ServiceAccountCredentials {
    if (cachedCredentials) return cachedCredentials;

    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
        throw new Error(
            "GOOGLE_SERVICE_ACCOUNT_JSON is not configured. " +
                "Set it in .env.local (dev) or via `wrangler secret put` (prod). " +
                "The value should be the full JSON contents of a Google Cloud " +
                "service account key with the Vertex AI User role.",
        );
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error(
            "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. " +
                "Paste the full key file contents (curly braces and all).",
        );
    }

    if (!isServiceAccountJson(parsed)) {
        throw new Error(
            "GOOGLE_SERVICE_ACCOUNT_JSON is missing required fields " +
                "(client_email, private_key, project_id).",
        );
    }

    cachedCredentials = {
        clientEmail: parsed.client_email,
        // Wrangler/dotenv often round-trip the private_key as a JSON string
        // with literal "\n" escapes; restore them to real newlines so the
        // PEM parser sees the canonical "-----BEGIN..." block.
        privateKey: parsed.private_key.replace(/\\n/g, "\n"),
        projectId: parsed.project_id,
    };
    return cachedCredentials;
}

/** Project ID derived from the service account, overridable via env. */
export function getProjectId(): string {
    return process.env.GOOGLE_CLOUD_PROJECT ?? getServiceAccount().projectId;
}

/** Vertex AI region. Defaults to `us-central1` (broadest model availability). */
export function getLocation(): string {
    return process.env.GOOGLE_CLOUD_LOCATION ?? DEFAULT_LOCATION;
}

/**
 * Returns a valid OAuth access token, refreshing it if the cached one is
 * close to expiry. Concurrent callers share a single in-flight refresh.
 */
export async function getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && cachedToken.expiresAt - TOKEN_REFRESH_BUFFER_SECONDS > now) {
        return cachedToken.accessToken;
    }

    if (inFlightTokenFetch) return inFlightTokenFetch;

    inFlightTokenFetch = fetchNewToken().finally(() => {
        inFlightTokenFetch = null;
    });
    return inFlightTokenFetch;
}

/**
 * Test seam — clears module-scope state so unit tests can reset between
 * cases. Not used in production code paths.
 */
export function resetGoogleAuthForTests(): void {
    cachedCredentials = null;
    cachedKey = null;
    cachedToken = null;
    inFlightTokenFetch = null;
}

// ─── Internals ──────────────────────────────────────────────────────────────

async function fetchNewToken(): Promise<string> {
    const credentials = getServiceAccount();
    const assertion = await signServiceAccountJwt(credentials);

    const response = await fetch(TOKEN_URI, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:
            "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer" +
            `&assertion=${encodeURIComponent(assertion)}`,
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
            `Google OAuth token exchange failed (${response.status}): ` +
                detail.slice(0, 400),
        );
    }

    const payload = (await response.json()) as {
        access_token?: string;
        expires_in?: number;
    };

    if (!payload.access_token) {
        throw new Error("OAuth response did not include an access_token.");
    }

    const lifetime = payload.expires_in ?? TOKEN_LIFETIME_SECONDS;
    cachedToken = {
        accessToken: payload.access_token,
        expiresAt: Math.floor(Date.now() / 1000) + lifetime,
    };
    return cachedToken.accessToken;
}

/**
 * Builds and RS256-signs the JWT bearer assertion that proves possession of
 * the service account private key.
 */
async function signServiceAccountJwt(
    credentials: ServiceAccountCredentials,
): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const claim = {
        iss: credentials.clientEmail,
        scope: TOKEN_SCOPE,
        aud: TOKEN_URI,
        iat: now,
        exp: now + TOKEN_LIFETIME_SECONDS,
    };

    const headerSegment = bytesToBase64Url(jsonToBytes(header));
    const claimSegment = bytesToBase64Url(jsonToBytes(claim));
    const signingInput = `${headerSegment}.${claimSegment}`;

    const key = await loadPrivateKey(credentials.privateKey);
    const signatureBytes = await crypto.subtle.sign(
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        key,
        new TextEncoder().encode(signingInput),
    );
    const signature = bytesToBase64Url(new Uint8Array(signatureBytes));

    return `${signingInput}.${signature}`;
}

/**
 * Imports the PEM-encoded RSA private key into a Web Crypto `CryptoKey`.
 * Cached after the first call — key material doesn't change per request.
 */
async function loadPrivateKey(pem: string): Promise<CryptoKey> {
    if (cachedKey) return cachedKey;
    const der = pemToDer(pem);
    cachedKey = await crypto.subtle.importKey(
        "pkcs8",
        der,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"],
    );
    return cachedKey;
}

function pemToDer(pem: string): ArrayBuffer {
    const stripped = pem
        .replace(/-----BEGIN [A-Z ]+-----/g, "")
        .replace(/-----END [A-Z ]+-----/g, "")
        .replace(/\s+/g, "");
    const bytes = base64ToBytes(stripped);
    return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
}

function jsonToBytes(value: unknown): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(value));
}

function isServiceAccountJson(value: unknown): value is {
    client_email: string;
    private_key: string;
    project_id: string;
} {
    if (!value || typeof value !== "object") return false;
    const obj = value as Record<string, unknown>;
    return (
        typeof obj.client_email === "string" &&
        typeof obj.private_key === "string" &&
        typeof obj.project_id === "string"
    );
}
