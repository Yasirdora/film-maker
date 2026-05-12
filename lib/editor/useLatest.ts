"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * useLatest — keep a ref pinned to the latest value of `value`.
 *
 * Use when an imperative callback (e.g. an animation loop, scroll listener,
 * or canvas draw routine) needs to read the most recent prop/state without
 * being re-created every render. The ref is updated inside an effect, which
 * keeps render pure (mutating refs during render trips React 19's
 * `react-hooks/refs` rule and is unsafe under concurrent rendering).
 *
 * Example:
 *   const zoomRef = useLatest(zoom);
 *   const draw = useCallback(() => { use(zoomRef.current); }, []);
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
