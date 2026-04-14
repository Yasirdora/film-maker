"use client";

/**
 * TurnstileWidget — Cloudflare Turnstile challenge widget.
 *
 * Loads the Turnstile script on mount and renders a managed widget.
 * In managed mode, the widget is invisible when Cloudflare is confident
 * the user is human, and shows a checkbox challenge when uncertain.
 *
 * The parent component receives the verification token via `onVerify`
 * and includes it with the form submission (body or header).
 *
 * If `siteKey` is empty (Turnstile not configured), renders nothing
 * and the parent's form works without bot protection.
 */

import { useEffect, useRef, useCallback } from "react";

interface TurnstileWidgetProps {
    siteKey: string;
    onVerify: (token: string) => void;
    onExpire?: () => void;
}

declare global {
    interface Window {
        turnstile?: {
            render: (
                container: HTMLElement,
                options: {
                    sitekey: string;
                    callback: (token: string) => void;
                    "expired-callback"?: () => void;
                    theme?: "light" | "dark" | "auto";
                },
            ) => string;
            remove: (widgetId: string) => void;
            reset: (widgetId: string) => void;
        };
        __turnstileOnLoad?: () => void;
    }
}

const SCRIPT_URL =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__turnstileOnLoad";

export function TurnstileWidget({
    siteKey,
    onVerify,
    onExpire,
}: TurnstileWidgetProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onVerifyRef = useRef(onVerify);
    const onExpireRef = useRef(onExpire);

    // Keep callback refs in sync without triggering re-renders.
    useEffect(() => {
        onVerifyRef.current = onVerify;
        onExpireRef.current = onExpire;
    }, [onVerify, onExpire]);

    const renderWidget = useCallback(() => {
        if (!containerRef.current || widgetIdRef.current || !window.turnstile) {
            return;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => onVerifyRef.current(token),
            "expired-callback": () => onExpireRef.current?.(),
            theme: "auto",
        });
    }, [siteKey]);

    useEffect(() => {
        // If the script is already loaded (e.g. navigated back), render immediately.
        if (window.turnstile) {
            renderWidget();
            return;
        }

        // Register a global callback for the script's onload parameter.
        window.__turnstileOnLoad = renderWidget;

        // Load the script if it hasn't been loaded yet.
        if (!document.querySelector(`script[src^="${SCRIPT_URL.split("?")[0]}"]`)) {
            const script = document.createElement("script");
            script.src = SCRIPT_URL;
            script.async = true;
            document.head.appendChild(script);
        }

        return () => {
            // Cleanup: remove the widget on unmount.
            if (widgetIdRef.current && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current);
                widgetIdRef.current = null;
            }
        };
    }, [renderWidget]);

    if (!siteKey) return null;

    return <div ref={containerRef} />;
}
