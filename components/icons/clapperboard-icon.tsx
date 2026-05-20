"use client";

/**
 * ClapperboardIcon — static brand mark.
 */

import { forwardRef } from "react";

interface ClapperboardIconProps {
    className?: string;
    style?: React.CSSProperties;
}

export const ClapperboardIcon = forwardRef<SVGSVGElement, ClapperboardIconProps>(
    function ClapperboardIcon({ className, style }, ref) {
        return (
            <svg
                ref={ref}
                className={className}
                style={style}
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
                    style={{
                        transformOrigin: "882.45px 448.09px",
                        transform: "rotate(-15deg)",
                    }}
                    d="M882.45,448.09h47.91c.89,0,1.6-.72,1.6-1.6v-10.15c0-.89-.72-1.6-1.6-1.6h-47.17c-.84,0-1.54.65-1.6,1.49l-.74,10.15c-.07.93.67,1.72,1.6,1.72Z"
                />
            </svg>
        );
    }
);
