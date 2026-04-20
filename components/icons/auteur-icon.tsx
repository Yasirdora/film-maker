/**
 * AuteurIcon — shared brand mark for the Auteur (AI assistant) destination.
 *
 * Uses `currentColor` so callers control color via their own text-color
 * utilities; the `.auteur-eye-open` / `.auteur-eye-closed` class hooks drive
 * the blink animation defined in globals.css when an ancestor `.group` is
 * hovered or focus-visible.
 */

interface AuteurIconProps {
    className?: string;
    size?: number;
    strokeWidth?: number;
    eyeStrokeWidth?: number;
}

export function AuteurIcon({
    className,
    size = 24,
    strokeWidth = 1.5,
    eyeStrokeWidth = 2.25,
}: AuteurIconProps) {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            aria-hidden
        >
            <path
                d="M15.5129 0.846191H6.48722C3.37337 0.846191 0.846191 3.37337 0.846191 6.48722V15.5129C0.846191 18.6267 3.37337 21.1539 6.48722 21.1539H15.5129C18.6267 21.1539 21.1539 18.6267 21.1539 15.5129V6.48722C21.1539 3.37337 18.6267 0.846191 15.5129 0.846191Z"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M8 9V13"
                strokeWidth={eyeStrokeWidth}
                strokeLinecap="round"
                className="auteur-eye-open"
            />
            <path
                d="M14 9V13"
                strokeWidth={eyeStrokeWidth}
                strokeLinecap="round"
                className="auteur-eye-open"
            />
            <path
                d="M8 10V11"
                strokeWidth={eyeStrokeWidth}
                strokeLinecap="round"
                className="auteur-eye-closed"
            />
            <path
                d="M14 10V11"
                strokeWidth={eyeStrokeWidth}
                strokeLinecap="round"
                className="auteur-eye-closed"
            />
        </svg>
    );
}
