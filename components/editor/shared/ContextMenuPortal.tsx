"use client";

import { createPortal } from "react-dom";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export type ContextMenuPortalProps = {
  open: boolean;
  /** Screen X where the user right-clicked. */
  x: number;
  /** Screen Y where the user right-clicked. */
  y: number;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Context-menu portal — renders children at the cursor position.
 *
 * Unlike `Popover` (anchor-ref based), this positions at a fixed (x, y)
 * coordinate and clamps to the viewport edges so the menu never overflows.
 *
 * Closes on outside pointer-down, Escape, scroll, and window blur.
 */
export default function ContextMenuPortal({
  open,
  x,
  y,
  onClose,
  children,
}: ContextMenuPortalProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; origin: string } | null>(null);
  const isClient = useIsClient();

  /* Position after first render so we know the menu's measured size.
     The cleanup fires on (x, y) change AND on close, clearing `pos` so the
     menu stays hidden until the next measurement lands — important so a
     fresh open at a new cursor doesn't briefly flash at the prior position. */
  useLayoutEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;

    let left = x;
    let top = y;

    /* Flip horizontally if overflowing right. */
    const flipX = left + rect.width + pad > vw;
    if (flipX) left = Math.max(pad, x - rect.width);

    /* Flip vertically if overflowing bottom. */
    const flipY = top + rect.height + pad > vh;
    if (flipY) top = Math.max(pad, y - rect.height);

    /* Transform-origin from the corner nearest the click point. */
    const originX = flipX ? "right" : "left";
    const originY = flipY ? "bottom" : "top";

    /* Measure-then-position is the canonical use case for setState in a
     * layout effect — we must read DOM dimensions after the menu mounts
     * (at off-screen coordinates) to flip it into the viewport before
     * paint. The lint rule misses this legitimate pattern. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos({ top, left, origin: `${originY} ${originX}` });

    return () => setPos(null);
  }, [open, x, y]);

  /* Dismiss on outside click, Escape, scroll, and blur. */
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onScroll = () => onClose();
    const onBlur = () => onClose();

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [open, onClose]);

  if (!open || !isClient) return null;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        visibility: pos ? "visible" : "hidden",
        zIndex: 1200,
        /* Entrance micro-animation */
        opacity: pos ? 1 : 0,
        transform: pos ? "scale(1)" : "scale(0.96)",
        transformOrigin: pos?.origin ?? "top left",
        transition: "opacity 120ms ease, transform 120ms ease",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
