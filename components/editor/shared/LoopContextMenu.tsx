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
        className="ui-menu"
        style={{ minWidth: 160, display: "flex", flexDirection: "column" }}
        tabIndex={0}
      >
        <button
          role="menuitem"
          className="ui-menu-item"
          onClick={handleClearLoop}
        >
          Clear Selection
        </button>
      </div>
    </ContextMenuPortal>
  );
}
