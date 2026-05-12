"use client";

import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query. Initial render returns the SSR-safe default
 * (false). Components that depend on this should be inside a client-only
 * boundary (the audio editor already is — `dynamic({ ssr: false })`), so
 * there's no hydration mismatch.
 */
export function useMediaQuery(query: string, ssrDefault = false): boolean {
  const [matches, setMatches] = useState(ssrDefault);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 768px)");
}
