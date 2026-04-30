/**
 * Global type augmentations for the Film-maker project.
 *
 * This file is auto-included by TypeScript when the `types` directory
 * is referenced in tsconfig.json (or via `typeRoots`).
 */

/* ── Cloudflare Turnstile ──────────────────────────────────────────────────── */

interface TurnstileAPI {
    render: (
        container: HTMLElement,
        options: {
            sitekey: string;
            callback: (token: string) => void;
            "expired-callback"?: () => void;
            "error-callback"?: () => void;
            theme?: "light" | "dark" | "auto";
        },
    ) => string;
    remove: (widgetId: string) => void;
    reset: (widgetId: string) => void;
}

declare global {
    interface Window {
        turnstile?: TurnstileAPI;
    }
}

export {};
