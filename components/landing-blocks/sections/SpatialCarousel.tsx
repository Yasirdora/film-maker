"use client";

/**
 * SpatialCarousel — drag-spinnable 3D ring of looping clips.
 *
 *   sc-wrap          flex column: scene + controls
 *     sc-scene       perspective + drag surface
 *       sc-stage     responsive scaling
 *         sc-carousel  rotating ring
 *           sc-card[]  positioned around `RADIUS`, contain a <video>
 *
 * Behavior:
 *   • Drag → inertia → snap (kinetic scroll, in degrees).
 *   • Centered card auto-plays; others paused at t=0 so they replay clean.
 *   • Ring auto-advances on the centered video's `ended` event, with a
 *     30s safety timer in case the event never fires.
 *   • Animation pauses (cancels rAF) when offscreen and re-runs cleanly
 *     after a bfcache restore.
 *
 * Concerns are split into focused hooks (see below) so the component
 * itself stays declarative.
 */

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type RefObject,
} from "react";

import { useInView } from "../shared/use-in-view";
import {
    CAROUSEL_SLIDES,
    type CarouselSlide,
} from "./carousel-manifest";

/* ------------------------------------------------------------------ */
/*  Slide data                                                        */
/* ------------------------------------------------------------------ */
// Sources are auto-generated from public/assets/carousel/ — see
// scripts/generate-carousel-manifest.mjs. Drop new clips into that
// folder and the next build picks them up.

type Slide = CarouselSlide;

/* ------------------------------------------------------------------ */
/*  Geometry & motion constants                                        */
/* ------------------------------------------------------------------ */

// 19 ring slots gives ~19° per step, dense enough that adjacent cards
// overlap visually at the design's RADIUS — anything sparser leaves
// big gaps between cards. The slot count is decoupled from the source
// pool: when the manifest has fewer than 19 unique clips, samplePool
// cycles through them; when it has more, each slot picks a unique random.
const RING_LENGTH = 19;
const RADIUS = 950;
const STEP_DEG = 360 / RING_LENGTH;

/** Cards beyond this off-axis angle are hidden + non-interactive. */
const VISIBLE_HALF_ANGLE = 80;
/** Max brightness reduction at the visible-edge angle. */
const OFF_AXIS_DIM = 0.55;

/** Watchdog: if the centered video never fires `ended`, advance anyway. */
const ADVANCE_SAFETY_MS = 30_000;

/** Inertia: per-frame multiplier; lower = stops sooner. */
const VELOCITY_DAMPING = 0.92;
/** Velocity below this counts as "at rest" — start snapping to a card. */
const REST_VELOCITY = 0.1;
/** How aggressively to lerp from current target to the snap target. */
const SNAP_LERP = 0.1;
/** How aggressively the rendered angle catches up to the target. */
const ANGLE_LERP = 0.12;
/** Drag distance translation: full viewport drag = this many degrees. */
const DRAG_DEG_PER_VIEWPORT = 80;

/**
 * Three-tier preload by ring distance from the active card:
 *   0   → "auto"     (only the playing card pulls full bytes)
 *   1–4 → "metadata" (tiny fetch — enough for first-frame paint)
 *   5+  → "none"     (no network)
 *
 * Keeping `auto` to a single card means at most one heavy video transfer
 * is in flight at a time, even when several adjacent slides need to be
 * visible. Metadata fetches are a few KB each and let mobile Safari
 * paint frame 0 on the visible neighbors without any video data.
 */
const PRELOAD_AUTO_RADIUS = 0;
const PRELOAD_METADATA_RADIUS = 4;

/**
 * SSR fallback ring — first `RING_LENGTH` slides from the manifest in
 * deterministic order. Used for the server render + initial client
 * hydration to avoid a hydration mismatch. The component re-shuffles
 * to a random sample on the client after mount via `samplePool`.
 */
const SSR_RING_SLIDES: readonly Slide[] = padRing(
    CAROUSEL_SLIDES.slice(0, RING_LENGTH),
    RING_LENGTH,
);

/**
 * Pick `n` slides from `pool` for the ring.
 *
 *   pool.length >= n → unique random subset (every slot a different clip)
 *   pool.length <  n → shuffle, then cycle through to fill — clips
 *                      repeat but in randomized order
 *
 * Always shuffles so different visitors see different orderings, even
 * with a small pool. Server-side render uses `padRing` for a stable
 * deterministic order; the random sample takes over after hydration.
 */
function samplePool(pool: readonly Slide[], n: number): readonly Slide[] {
    if (pool.length === 0) return [];

    // Fisher–Yates partial shuffle of the pool (O(min(n, pool.length))).
    const shuffled = pool.slice();
    const rounds = Math.min(n, shuffled.length);
    for (let i = 0; i < rounds; i++) {
        const j = i + Math.floor(Math.random() * (shuffled.length - i));
        [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }

    if (shuffled.length >= n) return shuffled.slice(0, n);
    return Array.from(
        { length: n },
        (_, i) => shuffled[i % shuffled.length]!,
    );
}

/** Deterministic cycle of `pool` to fill exactly `n` slots — used for SSR. */
function padRing(pool: readonly Slide[], n: number): readonly Slide[] {
    if (pool.length === 0) return [];
    return Array.from({ length: n }, (_, i) => pool[i % pool.length]!);
}

/* ------------------------------------------------------------------ */
/*  Pure helpers                                                       */
/* ------------------------------------------------------------------ */

const cardTransform = (i: number): string =>
    `rotateY(${i * STEP_DEG}deg) translateZ(-${RADIUS}px)`;

const carouselTransform = (angle: number): string =>
    `translateZ(${RADIUS}px) rotateY(${angle}deg)`;

/** Wraps an angle in degrees into the signed range [-180, 180]. */
const wrapSigned = (deg: number): number =>
    (((deg % 360) + 540) % 360) - 180;

const getEventX = (e: MouseEvent | TouchEvent): number =>
    "touches" in e ? e.touches[0]!.pageX : e.pageX;

/** Shortest forward/backward distance between two ring indices. */
const ringDistance = (a: number, b: number, len: number): number => {
    const d = Math.abs(a - b) % len;
    return Math.min(d, len - d);
};

/**
 * Preload policy keyed on ring-distance from the active card. The
 * `isPredictedNext` flag identifies the card most likely to become
 * active on the next auto-advance — eager-buffering it with "auto"
 * means the rotation feels instant instead of waiting for bytes to
 * arrive when the new active starts to play.
 */
const preloadFor = (
    distance: number,
    isPredictedNext: boolean,
): "auto" | "metadata" | "none" => {
    if (distance <= PRELOAD_AUTO_RADIUS || isPredictedNext) return "auto";
    if (distance <= PRELOAD_METADATA_RADIUS) return "metadata";
    return "none";
};

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

/**
 * Counter that increments on bfcache restore. Use as an effect dep to
 * tear down + re-run loops that need a clean slate after the page is
 * restored from the back-forward cache (rAF + 3D compositing don't
 * always resume cleanly otherwise).
 */
function useBfcacheToken(): number {
    const [token, setToken] = useState(0);

    useEffect(() => {
        const onPageShow = (e: PageTransitionEvent) => {
            if (e.persisted) setToken((n) => n + 1);
        };
        window.addEventListener("pageshow", onPageShow);
        return () => window.removeEventListener("pageshow", onPageShow);
    }, []);

    return token;
}

interface RingMotionOptions {
    sceneRef: RefObject<HTMLElement | null>;
    carouselRef: RefObject<HTMLElement | null>;
    cardsRef: RefObject<(HTMLDivElement | null)[]>;
    paused: boolean;
    inView: boolean;
    /** Bumps re-mount the rAF loop (used after bfcache restore). */
    resetToken: number;
}

/**
 * Owns the ring's drag → inertia → snap motion and per-frame card
 * compositing. The angle/velocity loop bypasses React (mutates DOM via
 * refs each frame) so React only re-renders when the centered card
 * index changes.
 *
 * @returns activeIdx — current centered card
 * @returns advance   — imperative "rotate one step" (e.g. video onEnded)
 */
function useRingMotion({
    sceneRef,
    carouselRef,
    cardsRef,
    paused,
    inView,
    resetToken,
}: RingMotionOptions): { activeIdx: number; advance: () => void } {
    const [activeIdx, setActiveIdx] = useState(0);

    // Bridge React state into the long-lived rAF closure without
    // tearing the loop down on every toggle.
    const flagsRef = useRef({ paused, inView });
    flagsRef.current = { paused, inView };

    // Rebound on every effect run so the component can call
    // `advance()` (e.g. from <video onEnded>) and reach the active loop.
    const advanceRef = useRef<() => void>(() => {});
    const advance = useCallback(() => advanceRef.current(), []);

    useEffect(() => {
        const scene = sceneRef.current;
        const carousel = carouselRef.current;
        if (!scene || !carousel) return;

        let currentAngle = 0;
        let targetAngle = 0;
        let velocity = 0;
        let isDragging = false;
        let prevX = 0;
        let raf = 0;
        let lastCenter = -1;
        let renderedAngle = NaN;

        /**
         * Movement is "negligible" when the rendered angle is settled
         * within a fraction of a degree of the target and there's no
         * lingering inertia. When all four are stable we skip the
         * per-frame card mutations entirely — saves ~76 style writes
         * per idle frame on mobile GPUs.
         */
        const isAtRest = () =>
            !isDragging &&
            velocity === 0 &&
            Math.abs(targetAngle - currentAngle) < 0.01 &&
            Math.abs(currentAngle - renderedAngle) < 0.01;

        advanceRef.current = () => {
            if (
                flagsRef.current.paused ||
                isDragging ||
                !flagsRef.current.inView
            ) {
                return;
            }
            targetAngle -= STEP_DEG;
        };

        const onPointerDown = (e: MouseEvent | TouchEvent) => {
            if ("button" in e && e.button !== 0) return;
            isDragging = true;
            prevX = getEventX(e);
            velocity = 0;
            document.body.style.cursor = "grabbing";
        };

        const onPointerMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging) return;
            if (e.cancelable && "touches" in e) e.preventDefault();
            const x = getEventX(e);
            const deltaDeg =
                ((x - prevX) / window.innerWidth) * DRAG_DEG_PER_VIEWPORT;
            prevX = x;
            targetAngle -= deltaDeg;
            velocity = -deltaDeg;
        };

        const onPointerUp = () => {
            isDragging = false;
            document.body.style.cursor = "";
        };

        const tick = () => {
            // Inertia + snap when not actively dragging.
            if (!isDragging) {
                targetAngle += velocity;
                velocity *= VELOCITY_DAMPING;
                if (Math.abs(velocity) < REST_VELOCITY) {
                    velocity = 0;
                    const snap = Math.round(targetAngle / STEP_DEG) * STEP_DEG;
                    targetAngle += (snap - targetAngle) * SNAP_LERP;
                }
            }

            currentAngle += (targetAngle - currentAngle) * ANGLE_LERP;

            // Idle bail-out: nothing has moved since the last frame, so
            // there's no point doing 19+ DOM writes. The rAF still ticks
            // (cheap) so we pick up immediately when motion resumes.
            if (isAtRest()) {
                raf = requestAnimationFrame(tick);
                return;
            }

            carousel.style.transform = carouselTransform(currentAngle);
            renderedAngle = currentAngle;

            // Per-frame card compositing + center detection.
            let centerIdx = 0;
            let smallestAbs = Infinity;
            const cards = cardsRef.current ?? [];
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                if (!card) continue;
                const abs = Math.abs(wrapSigned(i * STEP_DEG + currentAngle));
                if (abs < smallestAbs) {
                    smallestAbs = abs;
                    centerIdx = i;
                }
                if (abs > VISIBLE_HALF_ANGLE) {
                    card.style.opacity = "0";
                    card.style.pointerEvents = "none";
                } else {
                    card.style.opacity = "1";
                    card.style.pointerEvents = "auto";
                    const dim = (abs / VISIBLE_HALF_ANGLE) * OFF_AXIS_DIM;
                    card.style.filter = `brightness(${1 - dim})`;
                }
            }

            if (centerIdx !== lastCenter) {
                lastCenter = centerIdx;
                setActiveIdx(centerIdx);
            }

            raf = requestAnimationFrame(tick);
        };

        scene.addEventListener("mousedown", onPointerDown);
        window.addEventListener("mousemove", onPointerMove);
        window.addEventListener("mouseup", onPointerUp);
        scene.addEventListener("touchstart", onPointerDown, { passive: false });
        scene.addEventListener("touchmove", onPointerMove, { passive: false });
        scene.addEventListener("touchend", onPointerUp);

        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            scene.removeEventListener("mousedown", onPointerDown);
            window.removeEventListener("mousemove", onPointerMove);
            window.removeEventListener("mouseup", onPointerUp);
            scene.removeEventListener("touchstart", onPointerDown);
            scene.removeEventListener("touchmove", onPointerMove);
            scene.removeEventListener("touchend", onPointerUp);
        };
    }, [sceneRef, carouselRef, cardsRef, resetToken]);

    return { activeIdx, advance };
}

interface VideoPlaybackOptions {
    videosRef: RefObject<(HTMLVideoElement | null)[]>;
    activeIdx: number;
    isPaused: boolean;
    isInView: boolean;
    onSafetyAdvance: () => void;
}

/**
 * Plays only the centered video; pauses + rewinds every other to t=0
 * so they replay clean when they next become centered. Schedules a
 * safety timer to advance the ring if the active video never fires
 * `ended` (codec/load failure).
 *
 * The optimized clips ship with no audio (`-an` in ffmpeg), so we don't
 * expose a mute toggle — every video stays muted.
 */
function useCenterVideoPlayback({
    videosRef,
    activeIdx,
    isPaused,
    isInView,
    onSafetyAdvance,
}: VideoPlaybackOptions): void {
    useEffect(() => {
        const videos = videosRef.current ?? [];
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            if (!video) continue;
            if (i === activeIdx) {
                if (isPaused || !isInView) {
                    video.pause();
                } else {
                    video.play().catch(() => {});
                }
            } else {
                video.pause();
                video.currentTime = 0;
            }
        }

        if (isPaused || !isInView) return;
        const safety = window.setTimeout(onSafetyAdvance, ADVANCE_SAFETY_MS);
        return () => window.clearTimeout(safety);
    }, [videosRef, activeIdx, isPaused, isInView, onSafetyAdvance]);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SpatialCarousel() {
    const sceneRef = useRef<HTMLDivElement>(null);
    const carouselRef = useRef<HTMLDivElement>(null);
    const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
    const videosRef = useRef<(HTMLVideoElement | null)[]>([]);

    const [isPaused, setIsPaused] = useState(false);

    // Server-render and initial-hydration use the deterministic SSR ring
    // so the markup matches; the random sample takes over after mount.
    const [ringSlides, setRingSlides] =
        useState<readonly Slide[]>(SSR_RING_SLIDES);
    useEffect(() => {
        setRingSlides(samplePool(CAROUSEL_SLIDES, RING_LENGTH));
    }, []);

    // Preload-trigger: fires 600px early so videos start fetching their
    // metadata while the user is still scrolling toward the section.
    const preloadReady = useInView(sceneRef, {
        threshold: 0,
        rootMargin: "600px",
    });
    // Playback-trigger: fires only once the carousel actually intersects
    // the viewport, so the active video doesn't decode while offscreen.
    const inView = useInView(sceneRef, { threshold: 0.25 });
    const bfToken = useBfcacheToken();

    const { activeIdx, advance } = useRingMotion({
        sceneRef,
        carouselRef,
        cardsRef,
        paused: isPaused,
        inView,
        resetToken: bfToken,
    });

    useCenterVideoPlayback({
        videosRef,
        activeIdx,
        isPaused,
        isInView: inView,
        onSafetyAdvance: advance,
    });

    return (
        <div className="sc-wrap">
            <div
                className="sc-scene"
                ref={sceneRef}
                aria-label="Spatial showcase carousel"
            >
                <div className="sc-stage">
                    <div className="sc-carousel" ref={carouselRef}>
                        {ringSlides.map((slide, i) => {
                            const distance = ringDistance(
                                i,
                                activeIdx,
                                RING_LENGTH,
                            );
                            // Auto-advance always rotates one step
                            // forward (advance() decreases targetAngle
                            // by STEP_DEG → activeIdx + 1 becomes
                            // center). Eager-preload that next slot so
                            // it's already buffered when it takes over.
                            const isPredictedNext =
                                i === (activeIdx + 1) % RING_LENGTH;
                            // Defer all network until the carousel is
                            // about to enter view (preloadReady fires
                            // 600px ahead of actual intersection).
                            const preload = preloadReady
                                ? preloadFor(distance, isPredictedNext)
                                : "none";
                            return (
                                <div
                                    key={`${slide.id}-${i}`}
                                    ref={(el) => {
                                        cardsRef.current[i] = el;
                                    }}
                                    className="sc-card"
                                    style={{ transform: cardTransform(i) }}
                                >
                                    {slide.poster ? (
                                        <img
                                            className="sc-card-poster"
                                            src={slide.poster}
                                            alt=""
                                            aria-hidden="true"
                                            decoding="async"
                                            loading="lazy"
                                        />
                                    ) : null}
                                    <video
                                        ref={(el) => {
                                            videosRef.current[i] = el;
                                        }}
                                        src={slide.video}
                                        aria-label={slide.alt}
                                        muted
                                        playsInline
                                        preload={preload}
                                        onEnded={advance}
                                    />
                                    <span className="sc-card-overlay" />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="sc-controls">
                <button
                    type="button"
                    className="sc-ctrl"
                    aria-label={isPaused ? "Play" : "Pause"}
                    onClick={() => setIsPaused((p) => !p)}
                >
                    {isPaused ? <PlayIcon /> : <PauseIcon />}
                </button>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function PlayIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M8 5v14l11-7z" />
        </svg>
    );
}

function PauseIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
        </svg>
    );
}

