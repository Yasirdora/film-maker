/**
 * Action icons — tiny SVGs used across action menus, card overlays,
 * and inline forms (studio card + project page header).
 *
 * Kept in one file so both surfaces stay visually consistent: if a
 * designer tweaks the pin stroke, every place that uses it updates at
 * once. Each icon accepts `size` (pixel dimension) and `className` for
 * colour / transform overrides.
 */

interface IconProps {
    size?: number;
    className?: string;
}

export function DotsIcon({ size = 16, className }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
            aria-hidden
        >
            <circle cx="5" cy="12" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="19" cy="12" r="1.75" />
        </svg>
    );
}

export function PinIcon({ size = 14, className }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden
        >
            <path d="M12 17v5" />
            <path d="M9 11L6.5 14.5a1 1 0 001 1.5h9a1 1 0 001-1.5L15 11V5l1-2H8l1 2z" />
        </svg>
    );
}

export function EditIcon({ size = 14, className }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden
        >
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    );
}

export function ArchiveIcon({ size = 14, className }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden
        >
            <rect x="3" y="4" width="18" height="4" rx="1" />
            <path d="M5 8v11a2 2 0 002 2h10a2 2 0 002-2V8" />
            <line x1="10" y1="12" x2="14" y2="12" />
        </svg>
    );
}

export function CheckIcon({ size = 14, className }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

export function CloseIcon({ size = 14, className }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden
        >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}
