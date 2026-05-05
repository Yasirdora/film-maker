/**
 * Vertex AI REST client.
 *
 * Thin wrapper around the four Vertex endpoints we use:
 *
 *   • `:generateContent`       — one-shot Gemini chat (title gen, Nano Banana
 *                                 image-from-content).
 *   • `:streamGenerateContent` — SSE-streamed Gemini chat (Auteur).
 *   • `:predict`               — Imagen text-to-image.
 *   • `:predictLongRunning` +  — Veo video generation (submit + poll).
 *     `:fetchPredictOperation`
 *
 * Auth is delegated to {@link getAccessToken}, which mints/caches an
 * OAuth bearer token from a service account. Project + location come from
 * the same module, so callers only pass model + body.
 *
 * Why hand-rolled instead of `@google/genai`: that SDK depends on
 * `google-auth-library` for Vertex AI, which uses Node-only crypto APIs
 * and won't run on Cloudflare Workers. Web Crypto + `fetch` works on both
 * runtimes with a single code path.
 */
import { getAccessToken, getLocation, getProjectId } from "./google-auth";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VertexPart {
    text?: string;
    inlineData?: { mimeType: string; data: string };
}

export interface VertexContent {
    role: "user" | "model";
    parts: VertexPart[];
}

export interface VertexGenerationConfig {
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
    responseModalities?: string[];
    thinkingConfig?: { thinkingBudget?: number };
}

export interface GenerateContentRequest {
    contents: VertexContent[];
    systemInstruction?: { parts: VertexPart[] };
    generationConfig?: VertexGenerationConfig;
}

export interface GenerateContentResponse {
    candidates?: Array<{
        content?: { parts?: VertexPart[] };
        finishReason?: string;
    }>;
}

export interface ImagenPredictRequest {
    prompt: string;
    sampleCount: number;
    aspectRatio?: string;
    negativePrompt?: string;
    /** "allow_adult" | "allow_all" | "dont_allow". */
    personGeneration?: string;
    /** "image/jpeg" | "image/png". */
    outputMimeType?: string;
    /** Surface RAI filter reasons in the response. */
    includeRaiReason?: boolean;
}

export interface ImagenPrediction {
    bytesBase64Encoded?: string;
    mimeType?: string;
    raiFilteredReason?: string;
}

export interface ImagenPredictResponse {
    predictions?: ImagenPrediction[];
}

export interface VeoPredictRequest {
    prompt: string;
    sampleCount: number;
    aspectRatio?: string;
    durationSeconds?: number;
    /** Optional starting frame for image-to-video. */
    image?: { bytesBase64Encoded: string; mimeType: string };
}

export interface VeoOperation {
    name: string;
    done?: boolean;
    error?: { code: number; message: string };
    response?: {
        videos?: Array<{
            bytesBase64Encoded?: string;
            gcsUri?: string;
            mimeType?: string;
        }>;
    };
}

export class VertexApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly body?: string,
    ) {
        super(message);
        this.name = "VertexApiError";
    }
}

// ─── Endpoint construction ──────────────────────────────────────────────────

/**
 * Veo's video output bytes are large; the regional aiplatform endpoint
 * supports them. `aiplatform.googleapis.com` (no region prefix) is the
 * global endpoint and works for all models too, but regional endpoints
 * give lower latency.
 */
function endpointFor(model: string, method: string): string {
    const project = getProjectId();
    const location = getLocation();
    return (
        `https://${location}-aiplatform.googleapis.com` +
        `/v1/projects/${project}` +
        `/locations/${location}` +
        `/publishers/google/models/${model}:${method}`
    );
}

// ─── HTTP plumbing ──────────────────────────────────────────────────────────

interface CallOptions {
    signal?: AbortSignal;
    /** Append `?alt=sse` etc. to the endpoint. */
    query?: Record<string, string>;
}

async function vertexFetch(
    url: string,
    body: unknown,
    options: CallOptions = {},
): Promise<Response> {
    const token = await getAccessToken();
    const finalUrl = options.query
        ? `${url}?${new URLSearchParams(options.query).toString()}`
        : url;

    return fetch(finalUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: options.signal,
    });
}

async function vertexJson<T>(
    url: string,
    body: unknown,
    options: CallOptions = {},
): Promise<T> {
    const response = await vertexFetch(url, body, options);
    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new VertexApiError(
            `Vertex AI request failed (${response.status}): ${detail.slice(0, 400)}`,
            response.status,
            detail,
        );
    }
    return (await response.json()) as T;
}

// ─── generateContent ────────────────────────────────────────────────────────

export async function generateContent(
    model: string,
    request: GenerateContentRequest,
    options: CallOptions = {},
): Promise<GenerateContentResponse> {
    const url = endpointFor(model, "generateContent");
    return vertexJson<GenerateContentResponse>(url, request, options);
}

// ─── streamGenerateContent ──────────────────────────────────────────────────

/**
 * Returns the raw SSE Response so callers can parse the stream however they
 * like. The caller owns reading + closing the body.
 */
export async function streamGenerateContent(
    model: string,
    request: GenerateContentRequest,
    options: CallOptions = {},
): Promise<Response> {
    const url = endpointFor(model, "streamGenerateContent");
    const response = await vertexFetch(url, request, {
        ...options,
        query: { ...options.query, alt: "sse" },
    });
    if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => "");
        throw new VertexApiError(
            `Vertex AI stream failed (${response.status}): ${detail.slice(0, 400)}`,
            response.status,
            detail,
        );
    }
    return response;
}

// ─── Imagen predict ─────────────────────────────────────────────────────────

export async function imagenPredict(
    model: string,
    request: ImagenPredictRequest,
    options: CallOptions = {},
): Promise<ImagenPredictResponse> {
    const url = endpointFor(model, "predict");

    // Vertex's Imagen predict API uses the (instance, parameters) split
    // instead of the flat shape the Gemini API SDK exposes.
    const parameters: Record<string, unknown> = {
        sampleCount: request.sampleCount,
    };
    if (request.aspectRatio) parameters.aspectRatio = request.aspectRatio;
    if (request.negativePrompt) parameters.negativePrompt = request.negativePrompt;
    if (request.personGeneration) {
        parameters.personGeneration = request.personGeneration;
    }
    if (request.outputMimeType) {
        parameters.outputOptions = { mimeType: request.outputMimeType };
    }
    if (request.includeRaiReason) parameters.includeRaiReason = true;

    return vertexJson<ImagenPredictResponse>(
        url,
        {
            instances: [{ prompt: request.prompt }],
            parameters,
        },
        options,
    );
}

// ─── Veo predictLongRunning + fetchPredictOperation ────────────────────────

/**
 * Submits a Veo job. Returns the operation name to poll. We don't pass
 * `storageUri`, so completed videos come back as inline base64 — no
 * separate signed-URL download step is needed.
 */
export async function veoSubmit(
    model: string,
    request: VeoPredictRequest,
    options: CallOptions = {},
): Promise<{ name: string }> {
    const url = endpointFor(model, "predictLongRunning");

    const instance: Record<string, unknown> = { prompt: request.prompt };
    if (request.image) instance.image = request.image;

    const parameters: Record<string, unknown> = {
        sampleCount: request.sampleCount,
    };
    if (request.aspectRatio) parameters.aspectRatio = request.aspectRatio;
    if (request.durationSeconds) {
        parameters.durationSeconds = request.durationSeconds;
    }

    return vertexJson<{ name: string }>(
        url,
        { instances: [instance], parameters },
        options,
    );
}

export async function veoFetch(
    model: string,
    operationName: string,
    options: CallOptions = {},
): Promise<VeoOperation> {
    const url = endpointFor(model, "fetchPredictOperation");
    return vertexJson<VeoOperation>(url, { operationName }, options);
}
