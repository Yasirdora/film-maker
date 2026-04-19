/**
 * Gemini image & video generation client.
 *
 * Image generation paths:
 *
 *   1. **Text-to-image** (Imagen models):
 *      Uses `generateImages` API. Supports aspect ratio, negative prompt,
 *      batch count (numberOfImages), and person generation controls.
 *
 *   2. **generateContent models** (Nano Banana / image-to-image):
 *      Uses `generateContent` API with responseModalities: ['IMAGE', 'TEXT'].
 *      Supports multimodal input for style transfer and editing.
 *
 * Video generation:
 *
 *   3. **Text-to-video** (Veo models):
 *      Uses `generateVideos` API (long-running operation). Submits the job,
 *      polls for completion, then downloads the video from the returned URI.
 */

import { GoogleGenAI, PersonGeneration } from "@google/genai";
import { getPhotoModel, getVideoModel } from "./constants";

// ─── Constants ──────────────────────────────────────────────────────────────

const GENERATION_TIMEOUT_MS = 180_000;
const MAX_RETRIES = 3;

/**
 * Models that use generateContent (with responseModalities: ['IMAGE', 'TEXT'])
 * instead of generateImages. These models support both text-to-image and
 * image-to-image via multimodal input.
 */
const GENERATE_CONTENT_MODELS = new Set([
    "gemini-2.5-flash-image",
]);

// ─── Client pool (round-robin across API keys) ─────────────────────────────

let apiKeys: string[] | null = null;
let clients: GoogleGenAI[] | null = null;
let clientIndex = 0;

/** Returns a raw API key (for authenticated downloads). */
function getApiKey(): string {
    if (apiKeys && apiKeys.length > 0) return apiKeys[0];
    // Force initialization.
    getClient();
    return apiKeys![0];
}

function getClient(): GoogleGenAI {
    if (clients) {
        const client = clients[clientIndex % clients.length];
        clientIndex++;
        return client;
    }

    // Support comma-separated keys (GOOGLE_GEMINI_API_KEYS) for multi-project
    // rotation, with fallback to the single-key env var.
    const keysRaw =
        process.env.GOOGLE_GEMINI_API_KEYS ??
        process.env.GOOGLE_GEMINI_API_KEY;

    if (!keysRaw) {
        throw new Error(
            "GOOGLE_GEMINI_API_KEYS is not configured. " +
            "Set it in .env.local (dev) or via wrangler secret put (prod).",
        );
    }

    const keys = keysRaw.split(",").map((k) => k.trim()).filter(Boolean);
    if (keys.length === 0) {
        throw new Error("No valid Gemini API keys found.");
    }
    apiKeys = keys;

    clients = keys.map(
        (apiKey) =>
            new GoogleGenAI({
                apiKey,
                httpOptions: {
                    timeout: GENERATION_TIMEOUT_MS,
                    retryOptions: { attempts: MAX_RETRIES + 1 },
                },
            }),
    );

    const client = clients[0];
    clientIndex = 1;
    return client;
}

// ─── Error type ─────────────────────────────────────────────────────────────

export class GenerationError extends Error {
    constructor(
        message: string,
        public readonly code:
            | "safety_filtered"
            | "no_output"
            | "api_error"
            | "quota_exceeded",
    ) {
        super(message);
        this.name = "GenerationError";
    }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ReferenceImageInput {
    /** Base64-encoded image bytes. */
    data: string;
    mimeType: string;
}

export interface GenerateImageParams {
    prompt: string;
    negativePrompt?: string;
    modelId: string;
    resolution: string;
    aspectRatio?: string;
    /** Number of images to generate (1–4). Only applies to text-to-image. */
    sampleCount?: number;
    /** When provided, uses generateContent with multimodal input. */
    referenceImages?: ReferenceImageInput[];
}

export interface GenerateImageResult {
    imageData: ArrayBuffer;
    mimeType: string;
}

// ─── Main entry point ───────────────────────────────────────────────────────

/**
 * Generates an image from a text prompt, optionally guided by
 * reference image(s).
 *
 * Returns raw image bytes + MIME type. Throws `GenerationError` on
 * safety filter, empty response, quota issues, or API errors.
 */
export async function generateImage(
    params: GenerateImageParams,
): Promise<GenerateImageResult[]> {
    const model = getPhotoModel(params.modelId);
    if (!model) {
        throw new GenerationError(
            `Unknown model: ${params.modelId}`,
            "api_error",
        );
    }

    const hasReference =
        params.referenceImages && params.referenceImages.length > 0;
    const isContentModel = GENERATE_CONTENT_MODELS.has(model.geminiModelId);

    if (hasReference || isContentModel) {
        // generateContent returns 1 image per call, so fire N in parallel.
        const count = Math.min(Math.max(1, params.sampleCount ?? 1), 4);
        const results = await Promise.all(
            Array.from({ length: count }, () =>
                generateWithContent(model.geminiModelId, params),
            ),
        );
        return results;
    }
    return generateTextToImage(params);
}

// ─── Text-to-image (Imagen via generateImages API) ────────────────────────

async function generateTextToImage(
    params: GenerateImageParams,
): Promise<GenerateImageResult[]> {
    const model = getPhotoModel(params.modelId)!;
    const ai = getClient();
    const count = Math.min(Math.max(1, params.sampleCount ?? 1), 4);

    let response;
    try {
        response = await ai.models.generateImages({
            model: model.geminiModelId,
            prompt: params.prompt,
            config: {
                numberOfImages: count,
                negativePrompt: params.negativePrompt || undefined,
                aspectRatio: params.aspectRatio ?? "1:1",
                outputMimeType: "image/jpeg",
                includeRaiReason: true,
                personGeneration: PersonGeneration.ALLOW_ADULT,
            },
        });
    } catch (err) {
        throw classifyError(err);
    }

    return extractFromImagen(response, count);
}

// ─── generateContent path (Nano Banana / image-to-image) ──────────────────

async function generateWithContent(
    geminiModelId: string,
    params: GenerateImageParams,
): Promise<GenerateImageResult> {
    const ai = getClient();

    // Build multimodal parts: reference images (if any) first, then text.
    const parts: Array<
        | { inlineData: { mimeType: string; data: string } }
        | { text: string }
    > = [];

    if (params.referenceImages) {
        for (const ref of params.referenceImages) {
            parts.push({
                inlineData: { mimeType: ref.mimeType, data: ref.data },
            });
        }
    }

    // gemini-2.5-flash-image is a chat-style model: without a generation
    // directive, a conversational prompt ("hi how are you") yields a text
    // reply and no image. Prefixing forces image output even for prompts
    // that don't read like a description.
    const directive =
        params.referenceImages && params.referenceImages.length > 0
            ? `Generate an image based on the reference(s) and this prompt: ${params.prompt}`
            : `Generate an image of: ${params.prompt}`;
    parts.push({ text: directive });

    let response;
    try {
        response = await ai.models.generateContent({
            model: geminiModelId,
            contents: [{ role: "user", parts }],
            config: {
                responseModalities: ["IMAGE", "TEXT"],
            },
        });
    } catch (err) {
        throw classifyError(err);
    }

    return extractFromGenerateContent(response);
}

// ─── Response extractors ────────────────────────────────────────────────────

function extractFromImagen(
    response: {
        generatedImages?: Array<{
            image?: { imageBytes?: string; mimeType?: string };
            raiFilteredReason?: string;
        }>;
    } | undefined,
    expectedCount: number,
): GenerateImageResult[] {
    const images = response?.generatedImages ?? [];

    if (images.length === 0) {
        throw new GenerationError(
            "The model could not generate an image for this prompt.",
            "no_output",
        );
    }

    const results: GenerateImageResult[] = [];
    let lastFilterReason: string | undefined;

    for (const generated of images) {
        if (generated.image?.imageBytes) {
            results.push(
                decodeBase64Image(
                    generated.image.imageBytes,
                    generated.image.mimeType ?? "image/jpeg",
                ),
            );
        } else if (generated.raiFilteredReason) {
            lastFilterReason = generated.raiFilteredReason;
        }
    }

    // If every single image was filtered, throw.
    if (results.length === 0) {
        throw new GenerationError(
            lastFilterReason ?? "The model could not generate an image for this prompt.",
            lastFilterReason ? "safety_filtered" : "no_output",
        );
    }

    // Partial filter: return whatever succeeded. Credit cost is based
    // on the requested count; the user still gets some images.
    return results;
}

function extractFromGenerateContent(
    response: {
        candidates?: Array<{
            content?: {
                parts?: Array<{
                    inlineData?: { mimeType?: string; data?: string };
                    text?: string;
                }>;
            };
        }>;
    } | undefined,
): GenerateImageResult {
    const parts = response?.candidates?.[0]?.content?.parts ?? [];

    // Find the first image part in the response.
    for (const part of parts) {
        if (part.inlineData?.data) {
            return decodeBase64Image(
                part.inlineData.data,
                part.inlineData.mimeType ?? "image/png",
            );
        }
    }

    throw new GenerationError(
        "The model could not generate an image for this prompt.",
        "no_output",
    );
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

function decodeBase64Image(
    base64: string,
    mimeType: string,
): GenerateImageResult {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return { imageData: bytes.buffer, mimeType };
}

function classifyError(err: unknown): GenerationError {
    const message = err instanceof Error ? err.message : String(err);

    if (
        message.includes("abort") ||
        message.includes("timeout") ||
        (err instanceof DOMException && err.name === "AbortError")
    ) {
        return new GenerationError(
            "Generation timed out. Please try again.",
            "api_error",
        );
    }

    if (message.includes("429") || message.includes("quota")) {
        return new GenerationError(
            "Generation quota exceeded. Please try again later.",
            "quota_exceeded",
        );
    }

    return new GenerationError(
        `Generation failed: ${message}`,
        "api_error",
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// Video generation (Veo)
// ═══════════════════════════════════════════════════════════════════════════

/** Maximum time to wait for a Veo video to finish generating. */
const VIDEO_POLL_TIMEOUT_MS = 300_000; // 5 minutes
const VIDEO_POLL_INTERVAL_MS = 10_000; // 10 seconds

export interface GenerateVideoParams {
    prompt: string;
    modelId: string;
    aspectRatio?: string;
    durationSeconds?: number;
    sampleCount?: number;
    /** Base64-encoded starting frame for image-to-video. */
    referenceImage?: ReferenceImageInput;
}

export interface GenerateVideoResult {
    videoData: ArrayBuffer;
    mimeType: string;
}

/**
 * Generates one or more videos from a text prompt using the Veo model.
 *
 * Each video is a separate long-running operation. Multiple videos are
 * generated in parallel, each using a different API key via round-robin
 * to maximize throughput.
 */
export async function generateVideo(
    params: GenerateVideoParams,
): Promise<GenerateVideoResult[]> {
    const count = Math.min(Math.max(1, params.sampleCount ?? 1), 4);

    if (count === 1) {
        const result = await generateSingleVideo(params);
        return [result];
    }

    // Fire N parallel video generation calls.
    const results = await Promise.all(
        Array.from({ length: count }, () => generateSingleVideo(params)),
    );
    return results;
}

async function generateSingleVideo(
    params: GenerateVideoParams,
): Promise<GenerateVideoResult> {
    const model = getVideoModel(params.modelId);
    if (!model) {
        throw new GenerationError(
            `Unknown video model: ${params.modelId}`,
            "api_error",
        );
    }

    const ai = getClient();
    const duration = Math.min(
        Math.max(params.durationSeconds ?? 8, model.minDuration),
        model.maxDuration,
    );

    // Submit the video generation job.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const request: any = {
        model: model.geminiModelId,
        prompt: params.prompt,
        config: {
            numberOfVideos: 1,
            durationSeconds: duration,
            aspectRatio: params.aspectRatio ?? "16:9",
        },
    };

    // Image-to-video: provide a starting frame.
    if (params.referenceImage) {
        request.image = {
            imageBytes: params.referenceImage.data,
            mimeType: params.referenceImage.mimeType,
        };
    }

    let operation;
    try {
        operation = await ai.models.generateVideos(request);
    } catch (err) {
        throw classifyError(err);
    }

    // Poll until the operation completes.
    const deadline = Date.now() + VIDEO_POLL_TIMEOUT_MS;
    let result = operation;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    while (!(result as any)?.done && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));
        try {
            result = await ai.operations.get({ operation: result });
        } catch (err) {
            throw classifyError(err);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(result as any)?.done) {
        throw new GenerationError(
            "Video generation timed out. Please try again.",
            "api_error",
        );
    }

    // Extract the video URI from the completed operation.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const generatedVideos = (result as any)?.response?.generatedVideos ?? [];
    const videoUri = generatedVideos[0]?.video?.uri;

    if (!videoUri) {
        throw new GenerationError(
            "The model could not generate a video for this prompt.",
            "no_output",
        );
    }

    // Download the video from the returned URI.
    // The URI requires the API key as a query parameter for auth.
    const apiKey = getApiKey();
    const separator = videoUri.includes("?") ? "&" : "?";
    const downloadUrl = `${videoUri}${separator}key=${apiKey}`;

    let videoResponse: Response;
    try {
        videoResponse = await fetch(downloadUrl);
    } catch (err) {
        throw new GenerationError(
            "Failed to download the generated video.",
            "api_error",
        );
    }

    if (!videoResponse.ok) {
        throw new GenerationError(
            `Failed to download video: ${videoResponse.status}`,
            "api_error",
        );
    }

    const videoData = await videoResponse.arrayBuffer();
    const mimeType = videoResponse.headers.get("content-type") ?? "video/mp4";

    return { videoData, mimeType };
}
