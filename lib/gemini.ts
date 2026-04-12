/**
 * Gemini image generation client.
 *
 * Uses the `@google/genai` SDK to call the Gemini generateContent API
 * with image output modality. The model generates an image in response
 * to a text prompt and returns the raw bytes + MIME type.
 *
 * Model:
 *   The model ID is read from `lib/constants.ts` (PHOTO_MODELS). For v0
 *   this is a Gemini model that supports image output via the
 *   `generateContent` endpoint. In v1 this may move to the dedicated
 *   Imagen `generateImages` endpoint or to Vertex AI.
 *
 * Resolution:
 *   Passed as `imageConfig.imageSize` ("1K", "2K", "4K"). The Gemini
 *   API natively supports this parameter — no scaling needed.
 *
 * Error handling:
 *   If the model refuses generation (safety filter), the response
 *   contains text parts with the reason but no image parts. We throw
 *   a `GenerationError` with a user-facing message and a machine-
 *   readable `code` so the caller can decide whether to refund.
 */

import { GoogleGenAI } from "@google/genai";
import { getPhotoModel, type Resolution } from "./constants";

// ─── Client singleton ───────────────────────────────────────────────────────

// Image generation timeout — 3 minutes. Gemini image gen typically
// takes 5-15s but can spike under load. The SDK sends an
// `X-Server-Timeout` header so Google can stop processing server-side.
const GENERATION_TIMEOUT_MS = 180_000;

// SDK retry config — exponential backoff with jitter, retries on
// 408, 429, 500, 502, 503, 504 + network errors. The SDK handles
// `Retry-After` headers from Google automatically.
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

export interface GenerateImageParams {
    prompt: string;
    negativePrompt?: string;
    modelId: string;
    resolution: Resolution;
    aspectRatio?: string;
}

export interface GenerateImageResult {
    /** Raw image bytes. */
    imageData: ArrayBuffer;
    /** MIME type (typically image/png or image/jpeg). */
    mimeType: string;
}

/**
 * Generates an image from a text prompt using the Gemini API.
 *
 * Returns the raw image bytes + MIME type on success. Throws
 * `GenerationError` on safety-filtered output, empty response,
 * quota issues, or API errors.
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

    let response;
    try {
        response = await ai.models.generateContent({
            model: model.geminiModelId,
            contents: params.prompt,
            config: {
                responseModalities: ["IMAGE", "TEXT"],
                imageConfig: {
                    imageSize: params.resolution,
                    aspectRatio: params.aspectRatio ?? "1:1",
                },
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        // Timeout — the SDK aborted after GENERATION_TIMEOUT_MS.
        if (
            message.includes("abort") ||
            message.includes("timeout") ||
            (err instanceof DOMException && err.name === "AbortError")
        ) {
            throw new GenerationError(
                "Image generation timed out. Please try again.",
                "api_error",
            );
        }

        if (message.includes("429") || message.includes("quota")) {
            throw new GenerationError(
                "Generation quota exceeded. Please try again later.",
                "quota_exceeded",
            );
        }

        throw new GenerationError(
            `Image generation failed: ${message}`,
            "api_error",
        );
    }

    // Extract the image from the response parts.
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(
        (p) => p.inlineData?.data && p.inlineData.mimeType,
    );

    if (!imagePart?.inlineData) {
        // Model responded but with no image — typically a safety filter.
        const textParts = parts
            .filter((p) => p.text)
            .map((p) => p.text)
            .join(" ");

        throw new GenerationError(
            textParts || "The model could not generate an image for this prompt.",
            textParts ? "safety_filtered" : "no_output",
        );
    }

    // Decode base64 to ArrayBuffer for R2 upload.
    const base64 = imagePart.inlineData.data!;
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return {
        imageData: bytes.buffer,
        mimeType: imagePart.inlineData.mimeType ?? "image/png",
    };
}
