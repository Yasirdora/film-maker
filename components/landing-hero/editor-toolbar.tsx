/**
 * Decorative "editor" rail along the hero's right edge. Purely visual
 * flavour — suggests the depth of tooling that lives inside the app —
 * with no interaction. Hidden on narrow viewports (see CSS module).
 *
 * Icons are inlined as SVG and declared as data so the markup stays a
 * simple `.map()`. To adjust the rail, edit `TOOLBAR_ICONS` below.
 */

import type { ReactNode } from "react";
import clsx from "clsx";

import styles from "./editor-toolbar.module.css";

interface ToolbarItem {
    key: string;
    /** Visual content rendered inside the slot — SVG, text label, or any ReactNode. */
    icon: ReactNode;
    /** Visual state hint. Purely cosmetic. */
    variant?: "dim";
}

/** Factory for the common SVG shell shared by most toolbar icons. */
const svgIcon = (children: ReactNode): ReactNode => (
    <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
    >
        {children}
    </svg>
);

const TOOLBAR_ICONS: ToolbarItem[] = [
    {
        key: "edit",
        icon: svgIcon(
            <path d="M19.22 3.86a2.15 2.15 0 0 0-3.04 0l-1.52 1.52-5.46 5.46a2 2 0 0 0-.54 1l-.8 3.2a1 1 0 0 0 1.2 1.2l3.2-.8a2 2 0 0 0 1-.54l5.46-5.46 1.52-1.52a2.15 2.15 0 0 0 0-3.06zM7.5 20.5h9M3.5 20.5h1" />,
        ),
    },
    {
        key: "lut",
        icon: <span className={styles.toolLabel}>LUT</span>,
    },
    {
        key: "triangle",
        icon: svgIcon(<polygon points="12 4 4 20 20 20" />),
    },
    {
        key: "grid",
        icon: svgIcon(
            <path d="M5 9h14M5 15h14M9 5v14M15 5v14" />,
        ),
    },
    {
        key: "drop",
        icon: svgIcon(
            <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />,
        ),
    },
    {
        key: "contrast",
        icon: svgIcon(
            <>
                <circle cx="12" cy="12" r="8" />
                <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
            </>,
        ),
    },
    {
        key: "frame",
        variant: "dim",
        icon: svgIcon(
            <rect
                x="4"
                y="4"
                width="16"
                height="16"
                rx="2"
                strokeDasharray="2 2"
            />,
        ),
    },
];

export function EditorToolbar() {
    return (
        <aside
            className={styles.editorToolbar}
            aria-hidden="true"
        >
            {TOOLBAR_ICONS.map((item) => (
                <div
                    key={item.key}
                    className={clsx(
                        styles.toolIcon,
                        item.variant === "dim" && styles.toolIconDim,
                    )}
                >
                    {item.icon}
                </div>
            ))}
        </aside>
    );
}
