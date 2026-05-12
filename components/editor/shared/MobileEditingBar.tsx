"use client";

import type { ReactNode } from "react";

export const MOB_EDITING_BAR_H = 56;

/**
 * Bottom-docked editing toolbar on mobile. The button row itself is supplied
 * by the caller so each editor (audio, video) can render its own tools while
 * sharing the dock geometry, height, and z-index.
 */
export default function MobileEditingBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        height: MOB_EDITING_BAR_H,
        flexShrink: 0,
        padding: "0 12px",
        background: "transparent",
        zIndex: 90,
      }}
    >
      {children}
    </div>
  );
}
