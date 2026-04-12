/**
 * Input — text field primitive.
 *
 * 44px height by default (iOS HIG touch target), 16px font-size to prevent
 * iOS Safari zoom-on-focus. Every other styling concern is driven through
 * tailwind classes on the call site via `className`.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    function Input({ className, type = "text", ...props }, ref) {
        return (
            <input
                ref={ref}
                type={type}
                className={cn(
                    "flex h-11 w-full rounded-xl border border-neutral-200 bg-white px-4",
                    "text-[16px] text-neutral-950 placeholder:text-neutral-400",
                    "transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50 dark:placeholder:text-neutral-500",
                    "dark:focus-visible:ring-neutral-50 dark:focus-visible:ring-offset-neutral-950",
                    className,
                )}
                {...props}
            />
        );
    },
);
