"use client";

/**
 * Plan-features checklist shown below the upgrade button.
 *
 * The first `visibleCount` features are always visible so visitors can
 * compare plans at a glance. Any remaining features collapse behind a
 * "+ N more" toggle that animates open via the grid-template-rows trick.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";

interface PlanFeaturesProps {
    features: readonly string[];
    /** Number of features shown before the fold. Defaults to 3. */
    visibleCount?: number;
}

export function PlanFeatures({ features, visibleCount = 3 }: PlanFeaturesProps) {
    const [expanded, setExpanded] = useState(false);

    const above = features.slice(0, visibleCount);
    const below = features.slice(visibleCount);

    return (
        <div className="mt-6">
            {/* Always-visible features */}
            <ul className="space-y-2.5">
                {above.map((feature) => (
                    <li
                        key={feature}
                        className="flex items-start gap-3 text-sm text-neutral-300"
                    >
                        <CheckIcon />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>

            {/* Expandable additional features */}
            {below.length > 0 && (
                <>
                    <div
                        className={cn(
                            "grid transition-[grid-template-rows] duration-300 ease-in-out",
                            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                        )}
                        aria-hidden={!expanded}
                    >
                        <div className="overflow-hidden">
                            <ul className="mt-2.5 space-y-2.5">
                                {below.map((feature) => (
                                    <li
                                        key={feature}
                                        className="flex items-start gap-3 text-sm text-neutral-300"
                                    >
                                        <CheckIcon />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="mt-5 border-t border-neutral-800 pt-4">
                        <button
                            type="button"
                            onClick={() => setExpanded((v) => !v)}
                            aria-expanded={expanded}
                            className="block w-full text-center text-xs text-neutral-500 transition-colors hover:text-neutral-300"
                        >
                            {expanded
                                ? "Show less −"
                                : `+ ${below.length} more feature${below.length !== 1 ? "s" : ""}`}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

function CheckIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="mt-0.5 shrink-0 text-neutral-500"
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}
