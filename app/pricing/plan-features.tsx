"use client";

/**
 * Collapsible plan-features checklist shown below the "Get [plan]"
 * button. Complements the short inline summary above the button by
 * letting users expand to see every feature in the plan, verbatim
 * from SUBSCRIPTION_PLANS.
 *
 * Animates height via the grid-template-rows 0fr → 1fr trick so the
 * panel smoothly expands without needing a JS-measured max-height.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";

interface PlanFeaturesProps {
    features: readonly string[];
}

export function PlanFeatures({ features }: PlanFeaturesProps) {
    const [expanded, setExpanded] = useState(false);

    return (
        <>
            <div
                className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-in-out",
                    expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
                aria-hidden={!expanded}
            >
                <div className="overflow-hidden">
                    <ul className="mt-8 space-y-3 text-sm">
                        {features.map((feature) => (
                            <li
                                key={feature}
                                className="flex items-start gap-3 text-neutral-200"
                            >
                                <CheckIcon />
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="mt-8 border-t border-neutral-800 pt-6">
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    aria-expanded={expanded}
                    className="block w-full text-center text-sm text-neutral-400 transition-colors hover:text-neutral-200"
                >
                    {expanded ? "Hide plan features −" : "View plan features +"}
                </button>
            </div>
        </>
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
