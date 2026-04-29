"use client";

import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Slide data                                                         */
/* ------------------------------------------------------------------ */

interface Slide {
  id: string;
  alt: string;
  video?: string;
  img?: string;
}

const SOURCE_SLIDES: readonly Slide[] = [
  { id: "cinema", video: "/assets/carousel/01.mp4", alt: "Cinema" },
  { id: "field", video: "/assets/carousel/04.mp4", alt: "Field" },
  { id: "surreal", video: "/assets/carousel/02.mp4", alt: "Surreal" },
  { id: "neon-street", video: "/assets/carousel/05.mp4", alt: "Neon Street" },
  { id: "neon-girl", video: "/assets/carousel/06.mp4", alt: "Neon Girl" },
  { id: "skater", video: "/assets/carousel/03.mp4", alt: "Skater" },
  { id: "purple", video: "/assets/carousel/07.mp4", alt: "Purple Aesthetic" },
  { id: "portrait", video: "/assets/carousel/08.mp4", alt: "Portrait" },
  { id: "basketball", video: "/assets/carousel/09.mov", alt: "Basketball" },
  { id: "ten", video: "/assets/carousel/10.mov", alt: "Cinematic short" },
  { id: "eleven", video: "/assets/carousel/11.mov", alt: "Cinematic vignette" },
];

/* ------------------------------------------------------------------ */
/*  Geometry & motion constants                                        */
/* ------------------------------------------------------------------ */

const RING_LENGTH = 19;
const RADIUS = 950;
const STEP_DEG = 360 / RING_LENGTH;

const VISIBLE_HALF_ANGLE = 80;
const OFF_AXIS_DIM = 0.55;

// Safety fallback: if a clip fails to fire `ended` (failed to load, codec
// issue), advance anyway so the ring doesn't stall. Real auto-advance is
// driven by the centered video's `ended` event.
const ADVANCE_SAFETY_MS = 30_000;
const VELOCITY_DAMPING = 0.92;
const REST_VELOCITY = 0.1;
const SNAP_LERP = 0.1;
const ANGLE_LERP = 0.12;
const DRAG_DEG_PER_VIEWPORT = 80;

// How many cards on either side of the centered card get `preload="auto"`.
// The rest stay on `preload="metadata"` so we don't fetch ~20 videos up-front.
const PRELOAD_NEIGHBOR_RADIUS = 1;

const RING_SLIDES: readonly Slide[] = Array.from(
  { length: RING_LENGTH },
  (_, i) => {
    const source = SOURCE_SLIDES[i % SOURCE_SLIDES.length]!;
    return { ...source, id: `ring-${i}` };
  },
);

/* ------------------------------------------------------------------ */
/*  Pure helpers                                                       */
/* ------------------------------------------------------------------ */

const cardTransform = (i: number): string =>
  `rotateY(${i * STEP_DEG}deg) translateZ(-${RADIUS}px)`;

const carouselTransform = (angle: number): string =>
  `translateZ(${RADIUS}px) rotateY(${angle}deg)`;

/** Wrap an angle in degrees into the signed range [-180, 180]. */
const wrapSigned = (deg: number): number =>
  (((deg % 360) + 540) % 360) - 180;

const getEventX = (e: MouseEvent | TouchEvent): number =>
  "touches" in e ? e.touches[0]!.pageX : e.pageX;

/** Shortest forward/backward distance between two ring indices. */
const ringDistance = (a: number, b: number, len: number): number => {
  const d = Math.abs(a - b) % len;
  return Math.min(d, len - d);
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SpatialCarousel() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const videosRef = useRef<(HTMLVideoElement | null)[]>([]);
  const lastCenterRef = useRef(-1);

  // Mirrors `isPaused` so the auto-advance interval can read the latest value
  // without re-creating the interval on every toggle.
  const pausedRef = useRef(false);

  // Bridge from the centered video's `ended` event into the rAF closure that
  // owns `targetAngle`. The rAF effect overwrites this on mount.
  const advanceRef = useRef<() => void>(() => {});

  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isInView, setIsInView] = useState(false);

  // Bumped on bfcache restore so the animation effect tears down and re-runs —
  // rAF + 3D compositing can fail to resume cleanly after Chrome restores
  // from the back-forward cache.
  const [bfRestoreCount, setBfRestoreCount] = useState(0);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBfRestoreCount((n) => n + 1);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // Play only the centered card's video; mute state applies to all.
  // Pausing the centered card preserves its playhead; switching center
  // resets the previous video to 0 so it restarts cleanly next time.
  // When the scene is offscreen, every video pauses (centered keeps playhead).
  useEffect(() => {
    videosRef.current.forEach((video, i) => {
      if (!video) return;
      video.muted = isMuted;
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
    });

    if (isPaused || !isInView) return;
    const safety = window.setTimeout(() => advanceRef.current(), ADVANCE_SAFETY_MS);
    return () => clearTimeout(safety);
  }, [isPaused, isMuted, activeIdx, isInView]);

  // Drag → inertia → snap, and per-frame card visibility.
  useEffect(() => {
    const carousel = carouselRef.current;
    const scene = carousel?.parentElement;
    if (!carousel || !scene) return;

    let currentAngle = 0;
    let targetAngle = 0;
    let velocity = 0;
    let isDragging = false;
    let previousX = 0;
    let raf = 0;
    let inView = false;

    advanceRef.current = () => {
      if (pausedRef.current || isDragging || !inView) return;
      targetAngle -= STEP_DEG;
    };

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if ("button" in e && e.button !== 0) return;
      isDragging = true;
      previousX = getEventX(e);
      velocity = 0;
      document.body.style.cursor = "grabbing";
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      if (e.cancelable && "touches" in e) e.preventDefault();
      const x = getEventX(e);
      const deltaDeg =
        ((x - previousX) / window.innerWidth) * DRAG_DEG_PER_VIEWPORT;
      previousX = x;
      targetAngle -= deltaDeg;
      velocity = -deltaDeg;
    };

    const onPointerUp = () => {
      isDragging = false;
      document.body.style.cursor = "";
    };

    const tick = () => {
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
      carousel.style.transform = carouselTransform(currentAngle);

      let centerIdx = 0;
      let smallestAbs = Infinity;
      cardsRef.current.forEach((card, i) => {
        if (!card) return;
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
      });

      if (centerIdx !== lastCenterRef.current) {
        lastCenterRef.current = centerIdx;
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

    // Only animate while the scene is in the viewport. Pause rAF entirely
    // when offscreen so we don't burn frames or composite a 3D ring nobody
    // can see; resume cleanly when it scrolls back into view.
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const next = entry.isIntersecting;
        if (next === inView) return;
        inView = next;
        setIsInView(next);
        if (inView) {
          if (!raf) raf = requestAnimationFrame(tick);
        } else if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(scene);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
      scene.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      scene.removeEventListener("touchstart", onPointerDown);
      scene.removeEventListener("touchmove", onPointerMove);
      scene.removeEventListener("touchend", onPointerUp);
    };
  }, [bfRestoreCount]);

  return (
    <div className="sc-wrap">
      <div className="sc-scene" aria-label="Spatial showcase carousel">
        <div className="sc-stage">
          <div className="sc-carousel" ref={carouselRef}>
            {RING_SLIDES.map((slide, i) => {
              const isNearActive =
                ringDistance(i, activeIdx, RING_LENGTH) <= PRELOAD_NEIGHBOR_RADIUS;
              return (
                <div
                  key={slide.id}
                  ref={(el) => {
                    cardsRef.current[i] = el;
                  }}
                  className="sc-card"
                  style={{ transform: cardTransform(i) }}
                >
                  {slide.video ? (
                    <video
                      ref={(el) => {
                        videosRef.current[i] = el;
                      }}
                      src={slide.video}
                      aria-label={slide.alt}
                      muted
                      playsInline
                      preload={isNearActive ? "auto" : "metadata"}
                      onEnded={() => advanceRef.current()}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={slide.img} alt={slide.alt} draggable={false} />
                  )}
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
        <button
          type="button"
          className="sc-ctrl"
          aria-label={isMuted ? "Unmute" : "Mute"}
          onClick={() => setIsMuted((m) => !m)}
        >
          {isMuted ? <MuteIcon /> : <UnmuteIcon />}
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

function MuteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="18"
      height="18"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function UnmuteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="18"
      height="18"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}
