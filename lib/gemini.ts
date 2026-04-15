/**
 * Gemini image generation client.
 *
 * Two generation paths:
 *
 *   1. **Text-to-image** (no reference images):
 *      Uses Imagen 4.0 via `generateImages` API. Supports aspect ratio,
 *      negative prompt, and person generation controls.
 *
 *   2. **Image-to-image** (with reference images):
 *      Uses Gemini 2.5 Flash Image via `generateContent` API. The user's
 *      reference image(s) and text prompt are sent as multimodal input,
 *      and the model returns a transformed image. Supports style transfer,
 *      editing, and compositional changes.
 *
 * The `editImage` API (StyleReferenceImage) is NOT used because it
 * requires Vertex AI — unavailable with a standard Gemini API key.
 */

import { GoogleGenAI, PersonGeneration } from "@google/genai";
import { getPhotoModel } from "./constants";

// ─── Constants ──────────────────────────────────────────────────────────────

const GENERATION_TIMEOUT_MS = 180_000;
const MAX_RETRIES = 3;

/**
 * Model used for image-to-image via generateContent. Must support
 * responseModalities: ['IMAGE', 'TEXT']. Verified working with the
 * standard Gemini API key.
 */
const IMAGE_TO_IMAGE_MODEL = "gemini-2.5-flash-image";

// ─── Client singleton ───────────────────────────────────────────────────────

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
): Promise<GenerateImageResult> {
    const hasReference =
        params.referenceImages && params.referenceImages.length > 0;

    if (hasReference) {
        return generateWithReference(params);
    }
    return generateTextToImage(params);
}

// ─── Text-to-image (Imagen 4.0) ────────────────────────────────────────────

async function generateTextToImage(
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

    let response;
    try {
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
    } catch (err) {
        throw classifyError(err);
    }

    return extractFromImagen(response);
}

// ─── Image-to-image (Gemini 2.5 Flash Image) ───────────────────────────────

async function generateWithReference(
    params: GenerateImageParams,
): Promise<GenerateImageResult> {
    const ai = getClient();

    // Build multimodal parts: reference images first, then text prompt.
    const parts: Array<
        | { inlineData: { mimeType: string; data: string } }
        | { text: string }
    > = [];

    for (const ref of params.referenceImages!) {
        parts.push({
            inlineData: { mimeType: ref.mimeType, data: ref.data },
        });
    }

    parts.push({ text: params.prompt });

    let response;
    try {
        response = await ai.models.generateContent({
            model: IMAGE_TO_IMAGE_MODEL,
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
): GenerateImageResult {
    const generated = response?.generatedImages?.[0];

    if (!generated?.image?.imageBytes) {
        const reason = generated?.raiFilteredReason;
        throw new GenerationError(
            reason ?? "The model could not generate an image for this prompt.",
            reason ? "safety_filtered" : "no_output",
        );
    }

    return decodeBase64Image(
        generated.image.imageBytes,
        generated.image.mimeType ?? "image/jpeg",
    );
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
