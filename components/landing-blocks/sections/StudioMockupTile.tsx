"use client";

import { useState, useCallback } from "react";
import StudioMockup from "./StudioMockup";

type Mode = "desktop" | "mobile";

function ModeToggleButton({ mode, onToggle }: { mode: Mode; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="studio-mock-btn-toggle"
      onClick={onToggle}
      title="Click to swap Desktop/Mobile view"
      aria-label={mode === "desktop" ? "Switch to mobile preview" : "Switch to desktop preview"}
      data-active={mode === "mobile"}
    >
      {mode === "mobile" ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="7" y="2" width="10" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M11 18h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="3" y="5" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M9 21h6M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      <span className="studio-mock-btn-toggle-label">
        {mode === "mobile" ? "Mobile" : "Desktop"}
      </span>
    </button>
  );
}

export default function StudioMockupTile() {
  const [mode, setMode] = useState<Mode>("desktop");

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === "desktop" ? "mobile" : "desktop"));
  }, []);

  return (
    <div className="studio-mock-tile-host studio-mock-tile-overlay">
      <div className="reversible-tile reversible-tile-bg-black studio-mock-tile-shell">
        <div className="tile-front tile5050 tile5050-asset-right tile5050-bg-black tile5050-dark tile5050-gradient-ai">
          <div className="tile5050-layout">
            <div className="tile5050-content copy-group copy-group-dark">
              <h3 className="tile5050-content-title copy-group-title headline2 markdown">
                <b>Studio</b> for <b>every&nbsp;Filmmaker</b>
              </h3>
              <div className="tile5050-content-body copy-group-body body-large">
                <p>
                  Built for accessibility &ndash; an intuitive workspace that
                  streamlines the process, even for first-time AI creators.
                </p>
              </div>
              <ModeToggleButton mode={mode} onToggle={toggleMode} />
            </div>
            <div className="tile5050-asset type:ImageAsset">
              <StudioMockup mode={mode} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
