"use client";

/**
 * usePopover — shared anchor-tracking and dismiss logic for popovers.
 *
 * Consolidates the pattern repeated across GalleryCardMenu,
 * ComposerSettings, and ProjectActionMenu:
 *
 *   1. Measure the anchor element's viewport rect via `useLayoutEffect`
 *      so the portal-rendered popover can position itself with `fixed`.
 *   2. Re-measure on `resize` and `scroll` (capture phase) so the
 *      popover tracks the anchor as the page moves.
 *   3. Dismiss on outside `mousedown` and `Escape` key, with a
 *      `setTimeout(0)` guard so the opening click doesn't immediately
 *      close the popover.
 *   4. Reset the cached rect to `null` when closed so the next open
 *      measures fresh — avoids a one-frame flash at a stale position.
 *
 * The hook is intentionally low-level — it returns the measured
 * `anchorRect` and a `menuRef` for the consumer to attach, but does
 * not render any portal or container. Each consumer retains full
 * control over positioning math, z-index, and styling.
 *
 * Usage:
 * ```tsx
 * const { anchorRect, menuRef } = usePopover({
 *     open,
 *     onClose,
 *     anchorRef: buttonRef,
 *     excludeRefs: [buttonRef],
 * });
 *
 * if (!open || !anchorRect) return null;
 *
 * return createPortal(
 *     <div ref={menuRef} style={{ position: "fixed", top: anchorRect.bottom + 6 }}>
 *         ...
 *     </div>,
 *     document.body,
 * );
 * ```
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface UsePopoverOptions {
    /** Whether the popover is currently open. */
    open: boolean;

    /** Called when the popover should close (outside click or Escape). */
    onClose: () => void;

    /**
     * Ref to the element the popover should anchor to (the trigger
     * button). Its `getBoundingClientRect()` is measured into
     * `anchorRect`.
     */
    anchorRef: React.RefObject<HTMLElement | null>;

    /**
     * Additional refs whose elements should be excluded from outside-
     * click detection. The `anchorRef` and the returned `menuRef` are
     * always excluded — pass any extra refs here (e.g. a separate
     * trigger button that should not count as "outside").
     */
    excludeRefs?: React.RefObject<HTMLElement | null>[];

    /**
     * Whether to dismiss on Escape key press. Defaults to `true`.
     * Set to `false` for popovers that manage their own keyboard
     * handling (e.g. a drill-down panel with its own Escape → back).
     */
    dismissOnEscape?: boolean;
}

export interface UsePopoverReturn {
    /**
     * The anchor element's current viewport rect, or `null` if the
     * popover is closed or the anchor hasn't been measured yet.
     * Use this for `position: fixed` placement math.
     */
    anchorRect: DOMRect | null;

    /**
     * Attach this ref to the popover's outermost container element.
     * Clicks inside this element are excluded from outside-click
     * detection.
     */
    menuRef: React.RefObject<HTMLDivElement | null>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function usePopover({
    open,
    onClose,
    anchorRef,
    excludeRefs = [],
    dismissOnEscape = true,
}: UsePopoverOptions): UsePopoverReturn {
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // ── Anchor measurement ────────────────────────────────────────
    //
    // useLayoutEffect so the rect is available before paint — the
    // popover needs it to compute its initial position. Without this,
    // the portal would flash at (0, 0) for one frame on open.

    useLayoutEffect(() => {
        if (!open) {
            // Drop the cached rect so the next open measures fresh
            // before painting.
            setAnchorRect(null);
            return;
        }

        function measure() {
            if (anchorRef.current) {
                setAnchorRect(anchorRef.current.getBoundingClientRect());
            }
        }

        measure();

        // Re-measure on resize and scroll (capture phase so we catch
        // scrolling inside nested containers, not just the window).
        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, true);
        return () => {
            window.removeEventListener("resize", measure);
            window.removeEventListener("scroll", measure, true);
        };
    }, [open, anchorRef]);

    // ── Dismiss handlers ──────────────────────────────────────────
    //
    // Registered inside a setTimeout(0) so the browser finishes
    // processing the current event (the click that opened the
    // popover) before we start listening. Without this, the opening
    // mousedown propagates to the new listener and immediately
    // closes the popover.

    useEffect(() => {
        if (!open) return;

        function handleMouseDown(e: MouseEvent) {
            const target = e.target as Node;

            // Ignore clicks inside the popover itself.
            if (menuRef.current?.contains(target)) return;

            // Ignore clicks on the anchor (the trigger button handles
            // its own toggle — without this exclusion the outside-click
            // fires first, closing the popover, then the button's
            // onClick toggles it back open).
            if (anchorRef.current?.contains(target)) return;

            // Ignore clicks on any extra excluded elements.
            for (const ref of excludeRefs) {
                if (ref.current?.contains(target)) return;
            }

            onClose();
        }

        function handleKeyDown(e: KeyboardEvent) {
            if (dismissOnEscape && e.key === "Escape") {
                onClose();
            }
        }

        const timer = setTimeout(() => {
            document.addEventListener("mousedown", handleMouseDown);
            document.addEventListener("keydown", handleKeyDown);
        }, 0);

        return () => {
            clearTimeout(timer);
            document.removeEventListener("mousedown", handleMouseDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, onClose, anchorRef, excludeRefs, dismissOnEscape]);

    return { anchorRect, menuRef };
}
