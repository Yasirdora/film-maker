"use client";

import { useState, useCallback, type ReactNode } from "react";

const BASE_CLASS = "reversible-tile reversible-tile-bg-black";

/**
 * A card with a front and back face. Clicking the button flips between them.
 * The CSS handles the transition; this component manages which face is active
 * via the `inert` attribute (hides the inactive face from screen readers and focus).
 */
export default function ReversibleTile({
  className = BASE_CLASS,
  alignTileContent,
  frontContent,
  backContent,
  isFlipped: controlledIsFlipped,
  hideFlipButton = false,
}: {
  className?: string;
  alignTileContent?: boolean;
  frontContent: ReactNode;
  backContent: ReactNode;
  isFlipped?: boolean;
  hideFlipButton?: boolean;
}) {
  const [localIsFlipped, setLocalIsFlipped] = useState(false);
  const isFlipped = controlledIsFlipped !== undefined ? controlledIsFlipped : localIsFlipped;
  const toggle = useCallback(() => setLocalIsFlipped((prev) => !prev), []);

  return (
    <div
      className={className}
      {...(alignTileContent ? { "data-align-tile-content": "true" } : {})}
    >
      <div
        className="tile-front-wrap tile-front-wrap-frontTileWrap"
        data-slot="front-tile"
        {...(isFlipped ? { inert: true } : {})}
      >
        {frontContent}
      </div>
      <div
        className="tile-front-wrap tile-back-wrap"
        data-slot="back-tile"
        {...(!isFlipped ? { inert: true } : {})}
      >
        {backContent}
      </div>
      {!hideFlipButton && (
        <button
          className="tile-flip-button"
          data-slot="open-close-button"
          aria-label={isFlipped ? "Show front" : "Show details"}
          aria-expanded={isFlipped}
          onClick={toggle}
        >
          {/* A `+` made of two perpendicular strokes — rotated 45° via CSS
              when expanded, so it reads as `×`. */}
          <svg
            className="tile-flip-icon"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            aria-hidden="true"
            focusable="false"
          >
            <line x1="10" y1="3" x2="10" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
