/**
 * Gemini image generation client.
 *
 * Uses the `@google/genai` SDK's `generateImages` API with Imagen 4.0.
 * This is a dedicated image generation endpoint — distinct from the
 * `generateContent` API used for text/chat.
 *
 * Model:
 *   `imagen-4.0-generate-001` — Google's latest image generation model.
 *   Verified working via the Gemini API key (not Vertex-only).
 *   The model ID is stored in `lib/constants.ts` and resolved at call
 *   time so switching models requires no code change.
 *
 * Resolution:
 *   The Imagen `generateImages` API does not support an explicit
 *   `imageSize` parameter — output resolution is determined by the
 *   model. The `aspectRatio` parameter is supported. Credit cost is
 *   flat per image for v0; resolution-based pricing activates when we
 *   move to a model/API that supports explicit size control.
 *
 * Error handling:
 *   If the model refuses generation (safety filter), the response's
 *   `raiFilteredReason` field contains the reason. We throw a typed
 *   `GenerationError` so the caller can decide whether to refund.
 */

import {
    GoogleGenAI,
    PersonGeneration,
    StyleReferenceImage,
} from "@google/genai";
import { getPhotoModel } from "./constants";

// ─── Client singleton ───────────────────────────────────────────────────────

const GENERATION_TIMEOUT_MS = 180_000;
const MAX_RETRIES = 3;

let cached: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
    if (cached) return cached;
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error(
            "GOOGLE_GEMINI_API_KEY is not configured. " +
            "Set it in .env.local (dev) or via wrangler secret put (prod).",
        );
    }
    cached = new GoogleGenAI({
        apiKey,
        httpOptions: {
            timeout: GENERATION_TIMEOUT_MS,
            retryOptions: { attempts: MAX_RETRIES + 1 },
        },
    });
    return cached;
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

// ─── Image generation ───────────────────────────────────────────────────────

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
    /** When provided, uses editImage() with style reference instead of generateImages(). */
    referenceImages?: ReferenceImageInput[];
}

export interface GenerateImageResult {
    imageData: ArrayBuffer;
    mimeType: string;
}

/**
 * Generates an image from a text prompt, optionally guided by a
 * reference image.
 *
 * When `referenceImages` is empty or absent: uses the Imagen
 * `generateImages` API (text-to-image).
 *
 * When `referenceImages` is provided: uses the Imagen `editImage`
 * API with `StyleReferenceImage` (style transfer — the generated
 * image adopts the visual style of the reference while following
 * the text prompt for content).
 *
 * Returns raw image bytes + MIME type. Throws `GenerationError` on
 * safety filter, empty response, quota issues, or API errors.
 */
export async function generateImage(
    params: GenerateImageParams,
): Promise<GenerateImageResult> {
    const model = getPhotoModel(params.modelId);
    if (!model) {
        throw new GenerationError(
            `Unknown model: ${params.modelId}`,
            "api_error",
        );
    }

    const ai = getClient();
    const hasReference =
        params.referenceImages && params.referenceImages.length > 0;

    let response;
    try {
        if (hasReference) {
            response = await ai.models.editImage({
                model: model.geminiModelId,
                prompt: params.prompt,
                referenceImages: params.referenceImages!.map((ref) => {
                    const styleRef = new StyleReferenceImage();
                    styleRef.referenceImage = {
                        imageBytes: ref.data,
                        mimeType: ref.mimeType,
                    };
                    return styleRef;
                }),
                config: {
                    numberOfImages: 1,
                    negativePrompt: params.negativePrompt || undefined,
                    outputMimeType: "image/jpeg",
                    includeRaiReason: true,
                    personGeneration: PersonGeneration.ALLOW_ADULT,
                },
            });
        } else {
            response = await ai.models.generateImages({
                model: model.geminiModelId,
                prompt: params.prompt,
                config: {
                    numberOfImages: 1,
                    negativePrompt: params.negativePrompt || undefined,
                    aspectRatio: params.aspectRatio ?? "1:1",
                    outputMimeType: "image/jpeg",
                    includeRaiReason: true,
                    personGeneration: PersonGeneration.ALLOW_ADULT,
                },
            });
        }
    } catch (err) {
        throw classifyError(err);
    }

    return extractImageFromResponse(response);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function classifyError(err: unknown): GenerationError {
    const message = err instanceof Error ? err.message : String(err);

    if (
        message.includes("abort") ||
        message.includes("timeout") ||
        (err instanceof DOMException && err.name === "AbortError")
    ) {
        return new GenerationError(
            "Image generation timed out. Please try again.",
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
        `Image generation failed: ${message}`,
        "api_error",
    );
}

function extractImageFromResponse(
    response: { generatedImages?: Array<{ image?: { imageBytes?: string; mimeType?: string }; raiFilteredReason?: string }> } | undefined,
): GenerateImageResult {
    const generatedImage = response?.generatedImages?.[0];

    if (!generatedImage?.image?.imageBytes) {
        const raiReason = generatedImage?.raiFilteredReason;
        throw new GenerationError(
            raiReason ??
            "The model could not generate an image for this prompt.",
            raiReason ? "safety_filtered" : "no_output",
        );
    }

    const base64 = generatedImage.image.imageBytes;
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return {
        imageData: bytes.buffer,
        mimeType: generatedImage.image.mimeType ?? "image/jpeg",
    };
}
