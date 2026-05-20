/**
 * Prompt-bar modes surfaced in the hero. Each mode advertises a
 * different destination for the submitted prompt:
 *
 *   • artistic-intelligence — routes to /artistic-intelligence (Film-maker's chat-style assistant)
 *   • help   — routes to a future docs/support surface
 *
 * The icons are inlined as SVG to avoid adding another icon import per
 * mode. Keep the shape small; anything richer belongs in /components.
 */

import type { ReactNode } from "react";

export interface HeroMode {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly href: (prompt: string) => string;
    readonly icon: ReactNode;
}

const iconProps = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
} as const;

function buildQuery(prompt: string): string {
    const trimmed = prompt.trim();
    if (!trimmed) return "";
    return `?${new URLSearchParams({ q: trimmed }).toString()}`;
}

export const HERO_MODES = [
    {
        id: "artistic-intelligence",
        label: "Artistic Intelligence",
        description: "Visual & artistic intelligence",
        href: (prompt) => `/artistic-intelligence${buildQuery(prompt)}`,
        icon: (
            <svg {...iconProps} aria-hidden="true">
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
        ),
    },
    {
        id: "help",
        label: "Help & Support",
        description: "Get answers and guidance",
        href: () => "/help",
        icon: (
            <svg {...iconProps} aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
        ),
    },
] as const satisfies readonly HeroMode[];

export type HeroModeId = (typeof HERO_MODES)[number]["id"];

/** Default mode — used wherever no explicit selection is made yet. The
 *  inferred type intentionally preserves the literal `id` so callers
 *  passing `DEFAULT_HERO_MODE.id` to a `HeroModeId`-typed prop type-check. */
export const DEFAULT_HERO_MODE = HERO_MODES[0];

/**
 * Look up a hero mode by id. Falls back to `DEFAULT_HERO_MODE` when the
 * id doesn't match a known mode, so the function is total over both
 * input and output and call sites never need their own fallback.
 *
 * The parameter is typed as `string` so untyped sources (URL params,
 * external links) resolve safely; well-typed callers passing a
 * `HeroModeId` always hit the happy path at runtime.
 */
export function getHeroMode(id: string): HeroMode {
    return HERO_MODES.find((mode) => mode.id === id) ?? DEFAULT_HERO_MODE;
}
