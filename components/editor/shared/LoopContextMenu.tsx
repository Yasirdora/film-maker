import type { KeyboardEvent } from "react";
import { useEditor } from "@/lib/editor/store";
import ContextMenuPortal from "./ContextMenuPortal";

interface LoopContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

export default function LoopContextMenu({ x, y, onClose }: LoopContextMenuProps) {
  const setLoopIn = useEditor((s) => s.setLoopIn);
  const setLoopOut = useEditor((s) => s.setLoopOut);
  const setLoopEnabled = useEditor((s) => s.setLoopEnabled);

  const handleClearLoop = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setLoopIn(0);
    setLoopOut(0);
    setLoopEnabled(false);
    onClose();
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      handleClearLoop(e);
    }
  };

  return (
    <ContextMenuPortal open x={x} y={y} onClose={onClose}>
      <div
        role="menu"
        onKeyDown={onMenuKeyDown}
        style={{
          minWidth: 160,
          background: "#161616",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12,
          padding: 4,
          boxShadow:
            "0 16px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
          color: "white",
          fontSize: 13,
          display: "flex",
          flexDirection: "column",
          outline: "none",
        }}
        tabIndex={0}
      >

        <button
          role="menuitem"
          className="ae-ctx-item"
          onClick={handleClearLoop}
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            background: "transparent",
            border: "none",
            color: "inherit",
            padding: "8px 10px",
            borderRadius: 6,
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        >
          Clear Selection
        </button>
      </div>
    </ContextMenuPortal>
  );
}
