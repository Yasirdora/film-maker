"use client";

import { Settings } from "@/components/editor/shared/icons";

/**
 * Desktop-only side rail (Help + Settings). Mobile surfaces these via the
 * project kebab menu in the PageBar instead — keeping a separate row on
 * mobile duplicated the Help affordance and crowded the bottom of the screen.
 */
export default function SideRail({
  onShowHelp,
}: {
  onShowHelp?: () => void;
}) {
  return (
    <nav
      className="flex flex-col items-center py-5 z-[100] shrink-0"
      style={{
        width: 60,
        background: "transparent",
      }}
      aria-label="Editor tools"
    >
      <div className="flex flex-col gap-2">
        <HelpBtn onClick={onShowHelp} />
        <SettingsBtn />
      </div>
    </nav>
  );
}

function HelpBtn({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Keyboard shortcuts (?)"
      aria-label="Keyboard shortcuts"
      className="relative flex items-center justify-center"
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        border: "none",
        background: "transparent",
        color: "rgba(255,255,255,0.45)",
        cursor: "pointer",
        transition: "all 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = "rgba(255,255,255,0.05)";
        el.style.color = "rgba(255,255,255,1)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = "transparent";
        el.style.color = "rgba(255,255,255,0.45)";
      }}
    >
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="7" />
        <path d="M6 6a2 2 0 1 1 2.5 1.9C8 8.4 8 9 8 9" />
        <circle cx="8" cy="11.5" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}

function SettingsBtn() {
  return (
    <button
      type="button"
      title="Settings"
      aria-label="Settings"
      className="relative flex items-center justify-center"
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        border: "none",
        background: "transparent",
        color: "rgba(255,255,255,0.45)",
        cursor: "pointer",
        transition: "all 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = "rgba(255,255,255,0.05)";
        el.style.color = "rgba(255,255,255,1)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = "transparent";
        el.style.color = "rgba(255,255,255,0.45)";
      }}
    >
      <Settings width={20} height={20} />
    </button>
  );
}
