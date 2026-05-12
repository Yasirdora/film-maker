"use client";

import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * Returns true once we're rendering on the client. Uses
 * useSyncExternalStore so the mismatch is contained to the portal subtree
 * rather than triggering a top-level setState-in-effect.
 */
function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

type Placement = "bottom-end" | "bottom-start";

type PopoverProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  /** Pixels of space between the trigger and the popover. */
  offset?: number;
  /** Default `bottom-end` — top of popover aligned with bottom of anchor, right edges aligned. */
  placement?: Placement;
  /** Z-index of the floating layer. */
  zIndex?: number;
  children: ReactNode;
};

/**
 * Popover — minimal floating layer with three guarantees:
 *   1. Renders into `document.body` so sticky/overflow ancestors don't clip it.
 *   2. Closes on outside pointer-down and on Escape.
 *   3. Re-positions on scroll/resize so the trigger and popover stay glued.
 *
 * Use the same `anchorRef` you pass to your trigger. The popover is the
 * trigger's child in a logical sense — outside-click detection treats clicks
 * inside either element as "inside", so the trigger can toggle without race.
 *
 * Animation is intentionally absent — the parent decides whether to mount it
 * with a transition wrapper. Keeping this primitive headless avoids a class
 * of bugs where animation timing fights pointer/keyboard events.
 */
export default function Popover({
  open,
  anchorRef,
  onClose,
  offset = 6,
  placement = "bottom-end",
  zIndex = 1000,
  children,
}: PopoverProps) {
  const popRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const isClient = useIsClient();

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    const pop = popRef.current;
    if (!anchor || !pop) return;
    const a = anchor.getBoundingClientRect();
    const p = pop.getBoundingClientRect();
    const vh = window.innerHeight;
    const margin = 8;

    /* Vertical: prefer below the anchor, flip above when the popover would
       overflow the bottom and there's more room above. Cap height to the
       available space so the menu can scroll internally as a last resort. */
    const spaceBelow = vh - a.bottom - offset - margin;
    const spaceAbove = a.top - offset - margin;
    const flipAbove = p.height > spaceBelow && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, flipAbove ? spaceAbove : spaceBelow);
    const desiredHeight = Math.min(p.height, maxHeight);
    const top = flipAbove
      ? a.top - offset - desiredHeight
      : a.bottom + offset;

    const left =
      placement === "bottom-end" ? a.right - p.width : a.left;
    /* Clamp so the popover never falls off the right edge. */
    const maxLeft = window.innerWidth - p.width - margin;
    setPos({
      top,
      left: Math.max(margin, Math.min(maxLeft, left)),
      maxHeight,
    });
  }, [anchorRef, offset, placement]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    /* Recompute on scroll (any ancestor) and on viewport resize. */
    const onScrollOrResize = () => reposition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    /* Capture phase so we beat the trigger's own click handler if needed. */
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !isClient) return null;

  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        maxHeight: pos?.maxHeight,
        overflowY: "auto",
        visibility: pos ? "visible" : "hidden",
        zIndex,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
