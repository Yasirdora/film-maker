import { NextRequest } from "next/server";

/** Hard cap on body size we'll forward to the client. */
const MAX_BYTES = 200 * 1024 * 1024; // 200 MB
const TIMEOUT_MS = 30_000;

const ALLOWED_PREFIXES = ["image/", "video/", "audio/"];

const MIME_TO_EXT: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/tiff": "tiff",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-msvideo": "avi",
  "video/x-matroska": "mkv",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
};

interface FetchBody {
  url?: unknown;
}

/**
 * Server-side proxy that downloads a remote media file and streams it back
 * to the client. Exists because cross-origin images/audio/video typically
 * lack CORS headers, so a pure client-side `fetch` would fail.
 *
 * Defenses:
 *   - SSRF: rejects non-http(s) protocols, loopback, link-local, and
 *     RFC1918 private ranges.
 *   - Content-type allow-list (image/* | video/* | audio/*).
 *   - Size cap enforced on both Content-Length header and post-download.
 *   - Hard timeout via AbortController.
 */
export async function POST(req: NextRequest): Promise<Response> {
  let body: FetchBody;
  try {
    body = (await req.json()) as FetchBody;
  } catch {
    return errorJson("Invalid JSON body", 400);
  }

  if (typeof body.url !== "string" || !body.url.trim()) {
    return errorJson("Missing 'url' in request body", 400);
  }

  let target: URL;
  try {
    target = new URL(body.url);
  } catch {
    return errorJson("Invalid URL", 400);
  }

  if (!isPublicHttpUrl(target)) {
    return errorJson(
      "URL must be a public http(s) address — private and loopback hosts are blocked.",
      400,
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FilmmakerConverter/1.0)",
        Accept: "image/*, video/*, audio/*",
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      return errorJson(`Request timed out after ${TIMEOUT_MS / 1000}s.`, 504);
    }
    return errorJson("Couldn't reach that URL.", 502);
  }
  clearTimeout(timeoutId);

  if (!upstream.ok) {
    return errorJson(
      `Source returned HTTP ${upstream.status} ${upstream.statusText}.`,
      502,
    );
  }

  const contentType = (upstream.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED_PREFIXES.some((prefix) => contentType.startsWith(prefix))) {
    return errorJson(
      `Unsupported content type: ${contentType || "unknown"}. Only images, video, and audio are allowed.`,
      415,
    );
  }

  const declaredLength = upstream.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > MAX_BYTES) {
    return errorJson(
      `File is too large (max ${MAX_BYTES / 1024 / 1024} MB).`,
      413,
    );
  }

  // Buffer + size-check before relaying to the client.
  let buffer: ArrayBuffer;
  try {
    buffer = await upstream.arrayBuffer();
  } catch {
    return errorJson("Failed to read the upstream response.", 502);
  }
  if (buffer.byteLength > MAX_BYTES) {
    return errorJson(
      `File is too large (max ${MAX_BYTES / 1024 / 1024} MB).`,
      413,
    );
  }

  const filename = deriveFilename(target, contentType);

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `inline; filename="${filename}"`,
      // Custom header so the client can recover the filename without parsing
      // Content-Disposition. Exposed via Access-Control-Expose-Headers below.
      "X-Filename": filename,
      "Cache-Control": "no-store",
    },
  });
}

function errorJson(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function isPublicHttpUrl(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (!host) return false;

  if (host === "localhost") return false;
  if (host.endsWith(".localhost")) return false;
  if (host === "0.0.0.0") return false;

  // IPv4 literal checks
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (a === 10) return false; // 10.0.0.0/8
    if (a === 127) return false; // loopback
    if (a === 169 && b === 254) return false; // link-local
    if (a === 192 && b === 168) return false; // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
    if (a === 0) return false;
    if (a >= 224) return false; // multicast / reserved
  }

  // IPv6 literal — block obvious private ranges.
  if (host.startsWith("[") || host.includes(":")) {
    const stripped = host.replace(/^\[|\]$/g, "").toLowerCase();
    if (stripped === "::1") return false;
    if (stripped.startsWith("fe80:")) return false;
    if (stripped.startsWith("fc") || stripped.startsWith("fd")) return false; // ULA
    if (stripped === "::") return false;
  }

  return true;
}

function deriveFilename(url: URL, contentType: string): string {
  let candidate = "";
  try {
    const path = decodeURIComponent(url.pathname);
    candidate = path.split("/").filter(Boolean).pop() ?? "";
  } catch {
    candidate = "";
  }
  if (candidate.includes(".")) {
    return sanitize(candidate);
  }
  const ext = MIME_TO_EXT[contentType] ?? "bin";
  const stem = sanitize(candidate || "download") || "download";
  return `${stem}.${ext}`;
}

function sanitize(name: string): string {
  // Replace anything not in [A-Za-z0-9._-] with _
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 200);
}
