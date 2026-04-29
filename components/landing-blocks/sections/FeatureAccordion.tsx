"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Panel {
  brand: string;
  title: string;
  items: string[];
  gradient: string;
}

const PANELS: Panel[] = [
  {
    brand: "Direct",
    title: "Your AI co-director",
    items: [
      "Shot list",
      "Storyboards",
      "Coverage plans",
      "Script breakdowns",
    ],
    gradient: "linear-gradient(135deg, #141e30 0%, #243b55 40%, #4a6741 80%, #2d6a4f 100%)",
  },
  {
    brand: "Still",
    title: "Stills that hold the frame",
    items: [
      "Portraits",
      "Environments",
      "Concept art",
      "Stylised stills",
    ],
    gradient: "linear-gradient(135deg, #0f0c29 0%, #302b63 40%, #24243e 100%)",
  },
  {
    brand: "Motion",
    title: "Cinematic video",
    items: [
      "Camera control",
      "Character consistency",
      "Motion continuity",
      "Scene reasoning",
    ],
    gradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 35%, #0f3460 70%, #533483 100%)",
  },
  {
    brand: "Sound",
    title: "Score every scene",
    items: [
      "Orchestral cues",
      "Ambient beds",
      "Lipsync",
      "SFX & Foley",
    ],
    gradient: "linear-gradient(135deg, #0d1b2a 0%, #1b2838 30%, #2d4059 60%, #ea5455 100%)",
  },
];

const CYCLE_MS = 5000;

export default function FeatureAccordion() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progressKey, setProgressKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  const activate = useCallback((index: number) => {
    setActiveIndex((prev) => (prev === index ? prev : index));
    setProgressKey((k) => k + 1);
  }, []);

  const advance = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % PANELS.length);
    setProgressKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (paused) return;
    timerRef.current = window.setInterval(advance, CYCLE_MS);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [advance, paused, activeIndex]);

  return (
    <div
      className="feature-accordion"
      role="tablist"
      aria-label="Filmmaker feature highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {PANELS.map((panel, index) => {
        const isActive = index === activeIndex;
        return (
          <article
            key={panel.title}
            className="feature-accordion-panel"
            data-active={isActive}
            role="tab"
            aria-selected={isActive}
            aria-expanded={isActive}
            tabIndex={0}
            onClick={() => activate(index)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                activate(index);
              }
            }}
          >
            <div
              className="feature-accordion-bg"
              style={{ background: panel.gradient }}
              aria-hidden="true"
            />
            <div className="feature-accordion-overlay" aria-hidden="true" />
            <div className="feature-accordion-brand">{panel.brand}</div>
            <div className="feature-accordion-loader" aria-hidden="true">
              {isActive && (
                <span
                  key={progressKey}
                  className="feature-accordion-loader-fill"
                  data-running={!paused}
                />
              )}
            </div>
            <div className="feature-accordion-content">
              <h3 className="feature-accordion-title">{panel.title}</h3>
              <ul className="feature-accordion-list">
                {panel.items.map((item) => (
                  <li
                    key={item}
                    className="feature-accordion-item"
                    tabIndex={isActive ? 0 : -1}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        );
      })}
    </div>
  );
}
