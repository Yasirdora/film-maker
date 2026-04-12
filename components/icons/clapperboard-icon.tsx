"use client";

/**
 * ClapperboardIcon — animated brand mark.
 *
 * The top arm rotates open then snaps shut. Two ways to trigger:
 *   • `autoClap` — fires once on mount (after `autoDelay` ms).
 *   • Imperative `ref.current.clap()` — call from a parent on hover/focus.
 *
 * Animation styles live in globals.css as `.clapperboard-clap` so this
 * component stays portable and CSS-module-free.
 */

import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";

export interface ClapperboardIconHandle {
    clap: () => void;
}

interface ClapperboardIconProps {
    className?: string;
    style?: React.CSSProperties;
    autoClap?: boolean;
    autoDelay?: number;
}

export const ClapperboardIcon = forwardRef<
    ClapperboardIconHandle,
    ClapperboardIconProps
>(function ClapperboardIcon(
    { className, style, autoClap = false, autoDelay = 500 },
    ref,
) {
    const [isClapping, setIsClapping] = useState(false);
    const hasAutoClapped = useRef(false);

    const clap = useCallback(() => {
        setIsClapping((prev) => {
            if (prev) return prev;
            return true;
        });
    }, []);

    useImperativeHandle(ref, () => ({ clap }), [clap]);

    useEffect(() => {
        if (!autoClap || hasAutoClapped.current) return;
        hasAutoClapped.current = true;
        const timer = setTimeout(clap, autoDelay);
        return () => clearTimeout(timer);
    }, [autoClap, autoDelay, clap]);

    return (
        <svg
            className={className}
            style={style}
            data-clapping={isClapping || undefined}
            viewBox="870 420 75 60"
            xmlns="http://www.w3.org/2000/svg"
        >
            <rect
                fill="currentColor"
                x="880.73"
                y="448.09"
                width="51.24"
                height="26.61"
                rx="1.02"
                ry="1.02"
            />
            <path
                fill="currentColor"
                className={isClapping ? "clapperboard-clap" : undefined}
                style={{
                    transformOrigin: "882.45px 448.09px",
                    transform: isClapping ? undefined : "rotate(-15deg)",
                }}
                onAnimationEnd={() => setIsClapping(false)}
                d="M882.45,448.09h47.91c.89,0,1.6-.72,1.6-1.6v-10.15c0-.89-.72-1.6-1.6-1.6h-47.17c-.84,0-1.54.65-1.6,1.49l-.74,10.15c-.07.93.67,1.72,1.6,1.72Z"
            />
        </svg>
    );
});
