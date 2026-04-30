/**
 * ClapperboardArt — the geometry of Film-maker's clapperboard mark.
 *
 * Renders the two SVG primitives (`<rect>` base + `<path>` top arm)
 * inside whatever `<svg>` the caller already owns, so every consumer
 * can keep its own viewBox sizing, theming, and animation strategy
 * while pointing at one source of truth for the path data.
 *
 * To draw the mark, wrap this component in an SVG that uses
 * `CLAPPERBOARD_VIEWBOX`. To rotate / animate the hinged top arm,
 * use `CLAPPERBOARD_HINGE` as the transform-origin.
 *
 *   <svg viewBox={CLAPPERBOARD_VIEWBOX}>
 *     <ClapperboardArt
 *       topStyle={{
 *         transformOrigin: CLAPPERBOARD_HINGE,
 *         transform: "rotate(-15deg)",
 *       }}
 *     />
 *   </svg>
 *
 * Fills default to `currentColor`, so callers can theme the mark by
 * setting `color` (or override via class — CSS `fill` rules win over
 * the presentation attribute as usual).
 */

import type { CSSProperties, SVGProps } from "react";

/** viewBox to use for any SVG that wraps `<ClapperboardArt>`. */
export const CLAPPERBOARD_VIEWBOX = "870 420 75 60";

/** Transform-origin for the hinged top arm, in user-space units. */
export const CLAPPERBOARD_HINGE = "882.45px 448.09px";

interface ClapperboardArtProps {
    /** Class applied to the rotating top arm. */
    topClassName?: string;
    /** Inline style merged onto the top arm — used for fixed rotations
     *  (e.g. `rotate(-15deg)`) or CSS-driven `transform-origin`. */
    topStyle?: CSSProperties;
    /** Fires when the top arm's animation ends — for callers that
     *  toggle the clapping state on `animationend`. */
    onTopAnimationEnd?: SVGProps<SVGPathElement>["onAnimationEnd"];
    /** Class applied to the static base. Rarely needed, but exposed
     *  because the loader uses one shared class for both shapes. */
    baseClassName?: string;
}

export function ClapperboardArt({
    topClassName,
    topStyle,
    onTopAnimationEnd,
    baseClassName,
}: ClapperboardArtProps) {
    return (
        <>
            <rect
                className={baseClassName}
                fill="currentColor"
                x="880.73"
                y="448.09"
                width="51.24"
                height="26.61"
                rx="1.02"
                ry="1.02"
            />
            <path
                className={topClassName}
                fill="currentColor"
                style={topStyle}
                onAnimationEnd={onTopAnimationEnd}
                d="M882.45,448.09h47.91c.89,0,1.6-.72,1.6-1.6v-10.15c0-.89-.72-1.6-1.6-1.6h-47.17c-.84,0-1.54.65-1.6,1.49l-.74,10.15c-.07.93.67,1.72,1.6,1.72Z"
            />
        </>
    );
}
