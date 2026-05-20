"use client";

import { useEffect, useState } from "react";

type Mode = "desktop" | "mobile";

type ProjectTone = "teal" | "amber" | "indigo" | "magenta";

interface MockProject {
  title: string;
  detail: string;
  tone: ProjectTone;
  thumb: string;
}

const PROJECTS: MockProject[] = [
  { title: "Follow the light", detail: "Music · 01:35", tone: "magenta", thumb: "/assets/mockup/Follow the light.webp" },
  { title: "Mercedes Benz", detail: "Commercial · 00:30", tone: "amber", thumb: "/assets/mockup/Mercedes Benz.webp" },
  { title: "The detour", detail: "Narrative · 01:15", tone: "indigo", thumb: "/assets/mockup/The detour.webp" },
  { title: "Digging to Survive", detail: "Doc · 08:14", tone: "teal", thumb: "/assets/mockup/Digging to Survive.webp" },
];

export default function StudioMockup({ mode }: { mode: Mode }) {
  // Bumping these keys remounts the star SVG to restart its CSS animation.
  const [btnStarKey, setBtnStarKey] = useState(0);
  const [tabStarKey, setTabStarKey] = useState(0);

  // Trigger star animation when switching modes or on mount.
  useEffect(() => {
    // Small delay to ensure the DOM is ready for the entrance animation.
    const id = window.setTimeout(() => {
      if (mode === "desktop") {
        setBtnStarKey((k) => k + 1);
      } else {
        setTabStarKey((k) => k + 1);
      }
    }, 100);
    return () => window.clearTimeout(id);
  }, [mode]);

  return (
    <div className="studio-mock" data-mode={mode}>
      <div className="studio-mock-screen">
        <div className="studio-mock-scroll">
          <nav className="studio-mock-topnav">
            <div className="studio-mock-logo-container">
              <div className="studio-mock-brand-mark" aria-label="Home">
                <svg
                  width="36"
                  height="36"
                  viewBox="870 420 75 60"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <rect fill="currentColor" x="880.73" y="448.09" width="51.24" height="26.61" rx="1.02" ry="1.02" />
                  <path
                    className="studio-mock-clapper-top"
                    fill="currentColor"
                    style={{ transformOrigin: "882.45px 448.09px", transform: "rotate(-15deg)" }}
                    d="M882.45,448.09h47.91c.89,0,1.6-.72,1.6-1.6v-10.15c0-.89-.72-1.6-1.6-1.6h-47.17c-.84,0-1.54.65-1.6,1.49l-.74,10.15c-.07.93.67,1.72,1.6,1.72Z"
                  />
                </svg>
              </div>
            </div>
            <div className="studio-mock-nav-actions">
              <button type="button" className="studio-mock-btn-start" aria-hidden={mode === "mobile"}>
                <svg
                  key={btnStarKey}
                  className="studio-mock-trigger-icon studio-mock-animate-star"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
                </svg>
                Start
              </button>
              <button type="button" className="studio-mock-btn-avatar" aria-label="Profile">
                <svg width="16" height="13" viewBox="0 0 169 139" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M84.5848 67.9723L84.5848 127.221" stroke="currentColor" strokeWidth="23.166" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M156.985 12.7638L103.395 43.3335" stroke="currentColor" strokeWidth="23.166" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M65.2873 43.3335L11.5848 11.5847" stroke="currentColor" strokeWidth="23.166" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </nav>

          <header className="studio-mock-header">
            <h1 className="studio-mock-welcome-title">Welcome!</h1>
            <p className="studio-mock-credits">
              1,973 credits<span className="studio-mock-mobile-span" />
            </p>
          </header>

          <section className="studio-mock-projects">
            <div className="studio-mock-projects-info">
              <h2 className="studio-mock-projects-title">
                Projects <span className="studio-mock-projects-count">19</span>
              </h2>
              <p className="studio-mock-projects-sub">Organize generations.</p>
            </div>
            <button type="button" className="studio-mock-btn-new">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New project
            </button>
          </section>

          <div className="studio-mock-projects-grid" role="list">
            {PROJECTS.map((project) => (
              <article
                key={project.title}
                className="studio-mock-project"
                data-tone={project.tone}
                role="listitem"
              >
                <div
                  className="studio-mock-project-thumb"
                  style={{
                    backgroundImage: `url("${encodeURI(project.thumb)}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                  aria-hidden="true"
                />
                <div className="studio-mock-project-meta">
                  <h3 className="studio-mock-project-title">{project.title}</h3>
                  <p className="studio-mock-project-detail">{project.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <nav className="studio-mock-tabbar" aria-hidden={mode !== "mobile"}>
          <div className="studio-mock-tab-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M10 15V9l5 3-5 3z" />
            </svg>
            <span>Artistic Intelligence</span>
          </div>
          <div className="studio-mock-tab-icon">
            <svg
              key={tabStarKey}
              className="studio-mock-trigger-icon studio-mock-animate-star"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
            </svg>
            <span>Start</span>
          </div>
          <div className="studio-mock-tab-icon studio-mock-tab-icon-active">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            <span>Projects</span>
          </div>
          <div className="studio-mock-tab-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            <span>Settings</span>
          </div>
        </nav>
      </div>
    </div>
  );
}
