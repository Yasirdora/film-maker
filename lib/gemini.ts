/**
 * Image & video generation client (Vertex AI).
 *
 * Three generation paths:
 *
 *   1. **Imagen text-to-image** — `imagenPredict()` → `:predict`. Returns
 *      one or more images in a single response (sampleCount).
 *
 *   2. **Gemini multimodal image** — `generateContent()` with
 *      `responseModalities: ['IMAGE', 'TEXT']`. Used by Nano Banana for
 *      style transfer / image-to-image. Returns one image per call, so
 *      we fan out N calls in parallel for batches.
 *
 *   3. **Veo video** — `veoSubmit()` → poll `veoFetch()`. Long-running;
 *      bounded by `VIDEO_POLL_TIMEOUT_MS` to fit Workers wall-clock limits.
 *
 * All paths classify failures into a small {@link GenerationError} taxonomy
 * so the UI can show a meaningful message instead of leaking raw upstream
 * text. The raw upstream message is logged for diagnostics but never
 * surfaced to end users.
 */
import { getPhotoModel, getVideoModel } from "./constants";
import { base64ToBytes } from "./base64";
import {
    generateContent,
    imagenPredict,
    veoFetch,
    veoSubmit,
    VertexApiError,
} from "./vertex-client";
import type {
    GenerateContentResponse,
    ImagenPredictResponse,
} from "./vertex-client";

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Models that use Gemini's multimodal `generateContent` instead of Imagen's
 * `:predict`. These models accept reference images for style transfer and
 * always return exactly one image per call.
 */
const GENERATE_CONTENT_MODELS = new Set(["gemini-2.5-flash-image"]);

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
        // generateContent returns one image per call; fan out for batches.
        const count = clamp(params.sampleCount ?? 1, 1, 4);
        return Promise.all(
            Array.from({ length: count }, () =>
                generateWithContent(model.geminiModelId, params),
            ),
        );
    }
    return generateTextToImage(model.geminiModelId, params);
}

// ─── Text-to-image (Imagen :predict) ──────────────────────────────────────

async function generateTextToImage(
    geminiModelId: string,
    params: GenerateImageParams,
): Promise<GenerateImageResult[]> {
    const count = clamp(params.sampleCount ?? 1, 1, 4);

    let response: ImagenPredictResponse;
    try {
        response = await imagenPredict(geminiModelId, {
            prompt: params.prompt,
            sampleCount: count,
            aspectRatio: params.aspectRatio ?? "1:1",
            negativePrompt: params.negativePrompt || undefined,
            outputMimeType: "image/jpeg",
            personGeneration: "allow_adult",
            includeRaiReason: true,
        });
    } catch (err) {
        throw classifyError(err);
    }

    return extractFromImagen(response);
}

// ─── generateContent path (Nano Banana / image-to-image) ──────────────────

async function generateWithContent(
    geminiModelId: string,
    params: GenerateImageParams,
): Promise<GenerateImageResult> {
    const parts: Array<
        { inlineData: { mimeType: string; data: string } } | { text: string }
    > = [];

    if (params.referenceImages) {
        for (const ref of params.referenceImages) {
            parts.push({
                inlineData: { mimeType: ref.mimeType, data: ref.data },
            });
        }
    }

    // gemini-2.5-flash-image is conversational by default — without an
    // explicit "generate an image" directive a casual prompt may yield
    // text only. Prefixing forces the image modality every time.
    const directive =
        params.referenceImages && params.referenceImages.length > 0
            ? `Generate an image based on the reference(s) and this prompt: ${params.prompt}`
            : `Generate an image of: ${params.prompt}`;
    parts.push({ text: directive });

    let response: GenerateContentResponse;
    try {
        response = await generateContent(geminiModelId, {
            contents: [{ role: "user", parts }],
            generationConfig: {
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
    response: ImagenPredictResponse,
): GenerateImageResult[] {
    const predictions = response.predictions ?? [];

    if (predictions.length === 0) {
        throw new GenerationError(
            "The model could not generate an image for this prompt.",
            "no_output",
        );
    }

    const results: GenerateImageResult[] = [];
    let lastFilterReason: string | undefined;

    for (const prediction of predictions) {
        if (prediction.bytesBase64Encoded) {
            results.push(
                decodeBase64Image(
                    prediction.bytesBase64Encoded,
                    prediction.mimeType ?? "image/jpeg",
                ),
            );
        } else if (prediction.raiFilteredReason) {
            lastFilterReason = prediction.raiFilteredReason;
        }
    }

    // If every image was filtered, surface the safety reason.
    if (results.length === 0) {
        throw new GenerationError(
            lastFilterReason ??
                "The model could not generate an image for this prompt.",
            lastFilterReason ? "safety_filtered" : "no_output",
        );
    }

    return results;
}

function extractFromGenerateContent(
    response: GenerateContentResponse,
): GenerateImageResult {
    const parts = response.candidates?.[0]?.content?.parts ?? [];

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
    const bytes = base64ToBytes(base64);
    return { imageData: bytes.buffer as ArrayBuffer, mimeType };
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function classifyError(err: unknown): GenerationError {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[gemini] raw error:", message);

    if (
        err instanceof DOMException && err.name === "AbortError" ||
        message.includes("abort") ||
        message.includes("timeout")
    ) {
        return new GenerationError(
            "Generation timed out. Please try again.",
            "api_error",
        );
    }

    const status = err instanceof VertexApiError ? err.status : undefined;

    if (
        status === 429 ||
        message.includes("RESOURCE_EXHAUSTED") ||
        message.toLowerCase().includes("quota") ||
        message.toLowerCase().includes("too many requests")
    ) {
        return new GenerationError(
            "Generation quota exceeded. Please try again later.",
            "quota_exceeded",
        );
    }

    if (status === 400 || message.toLowerCase().includes("bad request")) {
        return new GenerationError(
            "Generation failed: invalid request parameters.",
            "api_error",
        );
    }

    return new GenerationError(`Generation failed: ${message}`, "api_error");
}

// ═══════════════════════════════════════════════════════════════════════════
// Video generation (Veo)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maximum time to wait for a Veo video to finish generating.
 *
 * Cloudflare Workers on the default plan have a ~30 s wall-clock limit;
 * "unbound" billing extends that to 15 min. 90 s is a safe ceiling that
 * works on most plans and keeps the response acceptable to the user.
 * When a video takes longer, the route throws a timeout and the client
 * should display a "try again" message.
 */
const VIDEO_POLL_TIMEOUT_MS = 90_000;
const VIDEO_POLL_INTERVAL_MS = 10_000;

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

export async function generateVideo(
    params: GenerateVideoParams,
): Promise<GenerateVideoResult[]> {
    const count = clamp(params.sampleCount ?? 1, 1, 4);

    if (count === 1) {
        return [await generateSingleVideo(params)];
    }
    return Promise.all(
        Array.from({ length: count }, () => generateSingleVideo(params)),
    );
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

    const duration = clamp(
        params.durationSeconds ?? 8,
        model.minDuration,
        model.maxDuration,
    );

    let operation;
    try {
        operation = await veoSubmit(model.geminiModelId, {
            prompt: params.prompt,
            sampleCount: 1,
            aspectRatio: params.aspectRatio ?? "16:9",
            durationSeconds: duration,
            image: params.referenceImage
                ? {
                      bytesBase64Encoded: params.referenceImage.data,
                      mimeType: params.referenceImage.mimeType,
                  }
                : undefined,
        });
    } catch (err) {
        throw classifyError(err);
    }

    // Poll until done or we hit the wall-clock deadline.
    const deadline = Date.now() + VIDEO_POLL_TIMEOUT_MS;
    let result;

    while (Date.now() < deadline) {
        try {
            result = await veoFetch(model.geminiModelId, operation.name);
        } catch (err) {
            throw classifyError(err);
        }
        if (result.done) break;
        await new Promise((resolve) =>
            setTimeout(resolve, VIDEO_POLL_INTERVAL_MS),
        );
    }

    if (!result?.done) {
        throw new GenerationError(
            "Video generation timed out. Please try again.",
            "api_error",
        );
    }

    if (result.error) {
        throw new GenerationError(
            `Video generation failed: ${result.error.message}`,
            "api_error",
        );
    }

    const videos = result.response?.videos ?? [];
    const video = videos[0];

    if (!video?.bytesBase64Encoded) {
        throw new GenerationError(
            "The model could not generate a video for this prompt.",
            "no_output",
        );
    }

    const bytes = base64ToBytes(video.bytesBase64Encoded);
    return {
        videoData: bytes.buffer as ArrayBuffer,
        mimeType: video.mimeType ?? "video/mp4",
    };
}
