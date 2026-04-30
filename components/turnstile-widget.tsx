"use client";

/**
 * TurnstileWidget — Cloudflare Turnstile challenge widget.
 *
 * Loads the Turnstile script on mount and renders a managed widget.
 * In managed mode, the widget is invisible when Cloudflare is confident
 * the user is human, and shows a checkbox challenge when uncertain.
 *
 * The parent receives the verification token via `onVerify` and
 * includes it with the form submission (body or header).
 *
 * If the Turnstile CDN script fails to load within LOAD_TIMEOUT_MS,
 * `onLoadFailed` fires so the parent can degrade gracefully (e.g.
 * allow submission without bot-protection rather than locking the UI).
 *
 * Global type augmentations for `window.turnstile` live in
 * `types/globals.d.ts` — they are not inlined here to keep the module
 * focused on behaviour rather than ambient declarations.
 */

import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
} from "react";

// ─── Script loader (module-level singleton) ──────────────────────────────────

const SCRIPT_SRC =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Grace period before we consider the CDN unreachable. */
const LOAD_TIMEOUT_MS = 8_000;

/**
 * Module-scoped promise so the script is loaded at most once regardless
 * of how many widget instances mount. Resolves `true` on success,
 * `false` on timeout/error.
 */
let scriptPromise: Promise<boolean> | null = null;

function loadTurnstileScript(): Promise<boolean> {
    if (scriptPromise) return scriptPromise;

    scriptPromise = new Promise<boolean>((resolve) => {
        // Already loaded (e.g. navigated back in SPA).
        if (window.turnstile) {
            resolve(true);
            return;
        }

        const script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;

        const timeout = setTimeout(() => {
            resolve(false);
        }, LOAD_TIMEOUT_MS);

        script.addEventListener("load", () => {
            clearTimeout(timeout);
            // The script is loaded but the API object may appear async.
            // Poll briefly to allow Turnstile to self-initialize.
            const check = setInterval(() => {
                if (window.turnstile) {
                    clearInterval(check);
                    resolve(true);
                }
            }, 50);
            // Hard cap on polling in case the API never appears.
            setTimeout(() => {
                clearInterval(check);
                resolve(!!window.turnstile);
            }, 2_000);
        });

        script.addEventListener("error", () => {
            clearTimeout(timeout);
            resolve(false);
        });

        document.head.appendChild(script);
    });

    return scriptPromise;
}

// ─── Component ─────────────────────────��─────────────────────────────────────

interface TurnstileWidgetProps {
    siteKey: string;
    onVerify: (token: string) => void;
    onExpire?: () => void;
    /** Called if the Turnstile script fails to load within the timeout.
     *  The parent should allow form submission without a token (the
     *  server can decide whether to accept or reject). */
    onLoadFailed?: () => void;
}

export interface TurnstileWidgetHandle {
    /** Reset the widget to generate a fresh token. Call after a failed
     *  submission so the next retry sends a valid, unused token. */
    reset: () => void;
}

export const TurnstileWidget = forwardRef<
    TurnstileWidgetHandle,
    TurnstileWidgetProps
>(function TurnstileWidget({ siteKey, onVerify, onExpire, onLoadFailed }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onVerifyRef = useRef(onVerify);
    const onExpireRef = useRef(onExpire);
    const onLoadFailedRef = useRef(onLoadFailed);

    // Keep callback refs in sync without triggering re-renders.
    useEffect(() => {
        onVerifyRef.current = onVerify;
        onExpireRef.current = onExpire;
        onLoadFailedRef.current = onLoadFailed;
    }, [onVerify, onExpire, onLoadFailed]);

    useImperativeHandle(
        ref,
        () => ({
            reset: () => {
                if (widgetIdRef.current && window.turnstile) {
                    window.turnstile.reset(widgetIdRef.current);
                }
            },
        }),
        [],
    );

    const renderWidget = useCallback(() => {
        if (!containerRef.current || widgetIdRef.current || !window.turnstile) {
            return;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => onVerifyRef.current(token),
            "expired-callback": () => onExpireRef.current?.(),
            theme: "dark",
        });
    }, [siteKey]);

    useEffect(() => {
        let cancelled = false;

        loadTurnstileScript().then((loaded) => {
            if (cancelled) return;
            if (loaded) {
                renderWidget();
            } else {
                onLoadFailedRef.current?.();
            }
        });

        return () => {
            cancelled = true;
            if (widgetIdRef.current && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current);
                widgetIdRef.current = null;
            }
        };
    }, [renderWidget]);

    if (!siteKey) return null;

    return <div ref={containerRef} />;
});
