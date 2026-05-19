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

type ToolStatus = "alpha" | "beta" | "coming-soon";

type ToolTile = {
    label: string;
    description: string;
    href: string;
    accent: string;        // Tailwind text-* class on the glyph
    accentBorder: string;  // Tailwind border-* class on hover
    accentBg: string;      // Tailwind bg-* class on hover
    glyph: React.ReactNode;
    status?: ToolStatus;
};

const STATUS_LABEL: Record<ToolStatus, string> = {
    alpha: "Alpha",
    beta: "Beta",
    "coming-soon": "Coming soon",
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
        status: "alpha",
    },
    {
        label: "Audio editor",
        description: "Multi-track timeline, recording, mixing.",
        href: "/editor/audio",
        accent: "text-emerald-400",
        accentBorder: "group-hover:border-emerald-400/60",
        accentBg: "group-hover:bg-emerald-400/5",
        glyph: <WaveformGlyph />,
        status: "beta",
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
    {
        label: "Photo editor",
        description: "Open, adjust, and export images in your browser.",
        href: "/editor/photo",
        accent: "text-rose-300",
        accentBorder: "group-hover:border-rose-300/60",
        accentBg: "group-hover:bg-rose-300/5",
        glyph: <ImageGlyph />,
        status: "alpha",
    },
    {
        label: "Transcriber",
        description: "Turn speech in any clip into searchable text.",
        href: "/editor/transcriber",
        accent: "text-violet-300",
        accentBorder: "group-hover:border-violet-300/60",
        accentBg: "group-hover:bg-violet-300/5",
        glyph: <TranscriberGlyph />,
        status: "coming-soon",
    },
    {
        label: "Subtitle editor",
        description: "Time, edit, and style captions over your video.",
        href: "/editor/subtitles",
        accent: "text-cyan-300",
        accentBorder: "group-hover:border-cyan-300/60",
        accentBg: "group-hover:bg-cyan-300/5",
        glyph: <SubtitleGlyph />,
        status: "coming-soon",
    },
    {
        label: "Color grader",
        description: "Apply LUTs and grade footage with WebGL shaders.",
        href: "/editor/color",
        accent: "text-orange-300",
        accentBorder: "group-hover:border-orange-300/60",
        accentBg: "group-hover:bg-orange-300/5",
        glyph: <ColorGraderGlyph />,
        status: "coming-soon",
    },
    {
        label: "Motion designer",
        description: "Keyframe transforms — Ken Burns, parallax, and more.",
        href: "/editor/motion",
        accent: "text-indigo-300",
        accentBorder: "group-hover:border-indigo-300/60",
        accentBg: "group-hover:bg-indigo-300/5",
        glyph: <MotionGlyph />,
        status: "coming-soon",
    },
    {
        label: "Storyboard builder",
        description: "Sequence scene cards into a shot-by-shot plan.",
        href: "/editor/storyboard",
        accent: "text-teal-300",
        accentBorder: "group-hover:border-teal-300/60",
        accentBg: "group-hover:bg-teal-300/5",
        glyph: <StoryboardGlyph />,
        status: "coming-soon",
    },
];

export default function EditorLanding() {
    return (
        <main className="mx-auto max-w-[85rem] px-4 pb-12 pt-8 sm:px-6 sm:pt-10">
            <header className="mb-8 sm:mb-10">
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    Tools
                </h1>
                <p className="mt-1.5 text-sm text-ws-icon">
                    For video, audio, and media conversion. Secure client-side
                    processing.
                </p>
            </header>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                {TILES.map((tile) => {
                    const body = (
                        <>
                            <div
                                className={`flex h-12 w-12 items-center justify-center rounded-lg bg-white/[0.04] ${tile.accent}`}
                            >
                                {tile.glyph}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-base font-medium text-white">
                                        {tile.label}
                                    </span>
                                    {tile.status && (
                                        <span className="rounded-full border border-white/15 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ws-icon">
                                            {STATUS_LABEL[tile.status]}
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 text-sm text-ws-icon">
                                    {tile.description}
                                </p>
                            </div>
                        </>
                    );

                    if (tile.status === "coming-soon") {
                        return (
                            <div
                                key={tile.label}
                                aria-disabled="true"
                                className={tileClassName(tile)}
                            >
                                {body}
                            </div>
                        );
                    }

                    return (
                        <Link
                            key={tile.label}
                            href={tile.href}
                            aria-label={`Open ${tile.label.toLowerCase()}`}
                            className={tileClassName(tile)}
                        >
                            {body}
                        </Link>
                    );
                })}
            </div>
        </main>
    );
}

function tileClassName(tile: ToolTile): string {
    const base = [
        "group flex flex-col gap-4 rounded-xl border border-white/10 bg-ws-surface p-5 text-left",
        "transition-colors duration-150",
    ];
    if (tile.status === "coming-soon") {
        return [...base, "cursor-not-allowed opacity-60"].join(" ");
    }
    return [...base, tile.accentBorder, tile.accentBg].join(" ");
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

function ImageGlyph() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="1.75" />
            <path d="M21 16l-5-5L5 20" />
        </svg>
    );
}

function TranscriberGlyph() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0014 0M12 18v3" />
        </svg>
    );
}

function SubtitleGlyph() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M7 14h4M13 14h4M7 10h10" />
        </svg>
    );
}

function ColorGraderGlyph() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3v18M3 12h18" />
        </svg>
    );
}

function MotionGlyph() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 18c4-12 12-12 16 0" />
            <circle cx="4" cy="18" r="1.5" fill="currentColor" />
            <circle cx="12" cy="8" r="1.5" fill="currentColor" />
            <circle cx="20" cy="18" r="1.5" fill="currentColor" />
        </svg>
    );
}

function StoryboardGlyph() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="6" width="6" height="12" rx="1" />
            <rect x="11" y="6" width="6" height="12" rx="1" />
            <rect x="19" y="6" width="2" height="12" rx="1" />
        </svg>
    );
}
