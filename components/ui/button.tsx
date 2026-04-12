/**
 * Button — the primary interactive primitive.
 *
 * Modeled on shadcn/ui's Button API (variant + size via cva) but kept
 * intentionally small. We pull in new variants only when a real use case
 * demands them.
 *
 * Accessibility:
 *   • Focus-visible ring on keyboard navigation
 *   • Disabled state stops pointer events and dims the content
 *   • Respects `touch-action: manipulation` from globals.css for faster taps
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    [
        "inline-flex items-center justify-center gap-2",
        "rounded-xl font-medium text-sm leading-none",
        "transition-colors transition-transform",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-50",
        "focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950",
        "disabled:pointer-events-none disabled:opacity-50",
        "active:scale-[0.98]",
    ].join(" "),
    {
        variants: {
            variant: {
                primary:
                    "bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200",
                secondary:
                    "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-700",
                outline:
                    "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50 dark:hover:bg-neutral-900",
                ghost:
                    "text-neutral-900 hover:bg-neutral-100 dark:text-neutral-50 dark:hover:bg-neutral-800",
            },
            size: {
                sm: "h-9 px-3",
                md: "h-11 px-5", // 44px — meets iOS HIG touch-target minimum
                lg: "h-12 px-6 text-base",
            },
            fullWidth: {
                true: "w-full",
            },
        },
        defaultVariants: {
            variant: "primary",
            size: "md",
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    function Button(
        { className, variant, size, fullWidth, type = "button", ...props },
        ref,
    ) {
        return (
            <button
                ref={ref}
                type={type}
                className={cn(buttonVariants({ variant, size, fullWidth }), className)}
                {...props}
            />
        );
    },
);
