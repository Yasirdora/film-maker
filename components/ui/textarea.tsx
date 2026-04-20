/**
 * Textarea — multi-line text field primitive.
 *
 * Mirrors the {@link Input} primitive's styling so composers and forms
 * feel consistent. Auto-expanding behaviour is opt-in via the
 * `autoResize` prop — callers that need a fixed height (settings
 * textareas, notes) can leave it off.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    /** When true, the textarea grows up to `maxRows` lines as content is added. */
    autoResize?: boolean;
    /** Max rows the auto-resize is allowed to expand to. */
    maxRows?: number;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    function Textarea(
        { className, autoResize, maxRows = 8, onChange, ...props },
        ref,
    ) {
        const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

        // Forward the ref while keeping a local handle for sizing math.
        React.useImperativeHandle(
            ref,
            () => innerRef.current as HTMLTextAreaElement,
        );

        const resize = React.useCallback(() => {
            const el = innerRef.current;
            if (!el || !autoResize) return;
            // Clear the previous height so scrollHeight reflects just content.
            el.style.height = "auto";
            const lineHeight =
                parseFloat(getComputedStyle(el).lineHeight || "20") || 20;
            const maxHeight = lineHeight * maxRows;
            el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
            el.style.overflowY =
                el.scrollHeight > maxHeight ? "auto" : "hidden";
        }, [autoResize, maxRows]);

        React.useEffect(() => {
            if (autoResize) resize();
        }, [autoResize, resize, props.value]);

        return (
            <textarea
                ref={innerRef}
                rows={props.rows ?? 1}
                className={cn(
                    "flex w-full rounded-xl border border-neutral-200 bg-white px-4 py-3",
                    "text-[16px] text-neutral-950 placeholder:text-neutral-400",
                    "transition-colors resize-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50 dark:placeholder:text-neutral-500",
                    "dark:focus-visible:ring-neutral-50 dark:focus-visible:ring-offset-neutral-950",
                    className,
                )}
                onChange={(event) => {
                    onChange?.(event);
                    if (autoResize) resize();
                }}
                {...props}
            />
        );
    },
);
