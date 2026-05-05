"use client";

/**
 * Generation recovery poller — client-only.
 *
 * When the original generation fetch fails (Cloudflare 524 timeout,
 * network interruption, etc.), the generation may have actually
 * completed on the backend. This utility re-sends the same POST with
 * the same idempotency key to probe the server:
 *
 *   • 200 + status "done"  → generation succeeded, return the result
 *   • 409 (Conflict)       → still pending, keep polling
 *   • 200 + status "failed" / other error → generation truly failed
 *
 * The server's idempotency gate (UNIQUE constraint on the key) ensures
 * that re-POSTing never creates a duplicate generation or double-
 * charges credits. It simply returns the existing row's state.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PollResult {
    uid: string;
    status: "done" | "failed";
    imageUrls: string[];
    videoUrls: string[];
    creditCost: number;
    error: string | null;
}

// ─── Poller ────────────────────────────────────────────────────────────────

/**
 * Polls the generation endpoint until the server reports a terminal
 * state (done / failed) or the attempt budget is exhausted.
 *
 * Returns `null` if recovery failed (max attempts reached, aborted,
 * or every poll errored).
 */
export async function pollForCompletion(params: {
    /** "/api/generate" or "/api/generate-video" */
    endpoint: string;
    /** The exact JSON body used in the original request. */
    body: Record<string, unknown>;
    /** Maximum poll attempts before giving up. */
    maxAttempts: number;
    /** Delay in ms between polls. */
    intervalMs: number;
    /** Optional abort signal (e.g. from the composer's AbortController). */
    signal?: AbortSignal;
}): Promise<PollResult | null> {
    const { endpoint, body, maxAttempts, intervalMs, signal } = params;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Pause between attempts. The first pause gives the server a
        // moment to finish if it was mid-response when the connection
        // dropped.
        await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, intervalMs);
            signal?.addEventListener("abort", () => {
                clearTimeout(timer);
                resolve();
            }, { once: true });
        });
        if (signal?.aborted) return null;

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal,
            });

            // 409 Conflict → the generation row exists and is still
            // pending. Keep polling.
            if (res.status === 409) continue;

            // Try to parse JSON. Non-JSON responses (e.g. Cloudflare
            // error pages) are treated as transient failures.
            let data: Record<string, unknown>;
            try {
                data = await res.json();
            } catch {
                continue; // non-JSON body — retry
            }

            // Successful completion — return the result.
            if (res.ok && data.status === "done") {
                // Normalise both singular and plural URL keys
                // (the image endpoint returns `imageUrls`, the video
                // endpoint returns `videoUrls` normally but `videoUrl`
                // on an idempotency cache-hit).
                const imageUrls = (data.imageUrls as string[] | undefined) ?? [];
                const videoUrl = data.videoUrl as string | undefined;
                const videoUrls =
                    (data.videoUrls as string[] | undefined) ??
                    (videoUrl ? [videoUrl] : []);

                return {
                    uid: (data.uid as string) ?? "",
                    status: "done",
                    imageUrls,
                    videoUrls,
                    creditCost: (data.creditCost as number) ?? 0,
                    error: null,
                };
            }

            // The server explicitly says the generation failed.
            if (data.status === "failed" || (data.error && !res.ok && res.status !== 429)) {
                return {
                    uid: (data.uid as string) ?? "",
                    status: "failed",
                    imageUrls: [],
                    videoUrls: [],
                    creditCost: (data.creditCost as number) ?? 0,
                    error: (data.error as string) ?? "Generation failed.",
                };
            }

            // Rate-limited (429) — wait and retry.
            if (res.status === 429) continue;

            // Unknown non-OK status — retry.
            if (!res.ok) continue;
        } catch {
            // Network error during poll — keep trying.
            continue;
        }
    }

    // Exhausted all attempts without a terminal state.
    return null;
}
