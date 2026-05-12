/**
 * EditorLanding — entry view for /editor.
 *
 * Presents the three browser-side editing tools (video, audio, converter)
 * as equal-weight tiles. Each is a direct link — the video editor opens
 * with the canonical 16:9 (1920×1080) canvas; users can switch ratios
 * from inside the editor via the Canvas button in the PageBar.
 *
 * Tiles use Film-maker's workspace palette (`ws-*`) so the editor reads
 * as part of the same product surface as `/studio`. The accent color on
 * hover is the only per-tool variation.
 */

import Link from "next/link";

type ToolTile = {
    label: string;
    description: string;
    href: string;
    accent: string;        // Tailwind text-* class on the glyph
    accentBorder: string;  // Tailwind border-* class on hover
    accentBg: string;      // Tailwind bg-* class on hover
    glyph: React.ReactNode;
};

const TILES: ToolTile[] = [
    {
        label: "Video editor",
        description: "Trim, cut, layer clips on a frame-accurate timeline.",
        href: "/editor/video",
        accent: "text-amber-300",
        accentBorder: "group-hover:border-amber-300/60",
        accentBg: "group-hover:bg-amber-300/5",
        glyph: <FilmGlyph />,
    },
    {
        label: "Audio editor",
        description: "Multi-track timeline, recording, mixing.",
        href: "/editor/audio",
        accent: "text-emerald-400",
        accentBorder: "group-hover:border-emerald-400/60",
        accentBg: "group-hover:bg-emerald-400/5",
        glyph: <WaveformGlyph />,
    },
    {
        label: "Media converter",
        description: "Convert between video, audio, and image formats.",
        href: "/editor/converter",
        accent: "text-sky-400",
        accentBorder: "group-hover:border-sky-400/60",
        accentBg: "group-hover:bg-sky-400/5",
        glyph: <ConverterGlyph />,
    },
];

export default function EditorLanding() {
    return (
        <main className="mx-auto max-w-[85rem] px-4 pb-12 pt-8 sm:px-6 sm:pt-10">
            <header className="mb-8 sm:mb-10">
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    Editor
                </h1>
                <p className="mt-1.5 text-sm text-ws-icon">
                    Browser-side tools for video, audio, and media conversion.
                    Files never leave your device.
                </p>
            </header>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                {TILES.map((tile) => (
                    <Link
                        key={tile.label}
                        href={tile.href}
                        aria-label={`Open ${tile.label.toLowerCase()}`}
                        className={tileClassName(tile)}
                    >
                        <div
                            className={`flex h-12 w-12 items-center justify-center rounded-lg bg-white/[0.04] ${tile.accent}`}
                        >
                            {tile.glyph}
                        </div>
                        <div>
                            <div className="text-base font-medium text-white">
                                {tile.label}
                            </div>
                            <p className="mt-1 text-sm text-ws-icon">
                                {tile.description}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </main>
    );
}

function tileClassName(tile: ToolTile): string {
    return [
        "group flex flex-col gap-4 rounded-xl border border-white/10 bg-ws-surface p-5 text-left",
        "transition-colors duration-150",
        tile.accentBorder,
        tile.accentBg,
    ].join(" ");
}

/* ─── Glyphs ──────────────────────────────────────────────────────────────── */

function FilmGlyph() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 9h18M3 15h18M8 4v16M16 4v16" />
        </svg>
    );
}

function WaveformGlyph() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="3" y="10" width="2" height="4" rx="1" />
            <rect x="6.5" y="7" width="2" height="10" rx="1" />
            <rect x="10" y="4" width="2" height="16" rx="1" />
            <rect x="13.5" y="8" width="2" height="8" rx="1" />
            <rect x="17" y="6" width="2" height="12" rx="1" />
            <rect x="20.5" y="11" width="2" height="2" rx="1" />
        </svg>
    );
}

function ConverterGlyph() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 8h12l-3-3M20 16H8l3 3" />
        </svg>
    );
}
