"use client";

/**
 * Compact toggle for the per-clip volume-envelope overlay. Shown in the
 * timeline's header column on desktop (audio editor only). Driven entirely
 * from the editor store so the same pressed state shows up in the project
 * kebab menu, the toolbar kebab, and here.
 */

import { useEditor } from "@/lib/editor/store";
import { ShowlinesIcon } from "@/components/editor/shared/icons";

export default function VolumeEnvelopeToggle() {
  const showVolumeEnvelopes = useEditor((s) => s.showVolumeEnvelopes);
  const toggleVolumeEnvelopes = useEditor((s) => s.toggleVolumeEnvelopes);

  return (
    <button
      type="button"
      onClick={toggleVolumeEnvelopes}
      title="Toggle volume envelopes"
      className="flex items-center justify-center transition-colors"
      style={{
        width: 26,
        height: 26,
        background: showVolumeEnvelopes ? "rgba(255,255,255,0.12)" : "transparent",
        border: "none",
        cursor: "pointer",
        color: showVolumeEnvelopes ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.45)",
        borderRadius: 6,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.color = "rgba(255,255,255,1)";
        if (!showVolumeEnvelopes) el.style.background = "rgba(255,255,255,0.06)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.color = showVolumeEnvelopes
          ? "rgba(255,255,255,1)"
          : "rgba(255,255,255,0.45)";
        if (!showVolumeEnvelopes) el.style.background = "transparent";
      }}
    >
      <ShowlinesIcon width={16} height={16} />
    </button>
  );
}
