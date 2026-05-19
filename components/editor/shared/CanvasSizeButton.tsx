"use client";

/**
 * CanvasSizeButton — canvas-aspect picker for the video editor's PageBar.
 *
 * A small dropdown of standard aspect ratios (16:9, 9:16, 1:1, 4:3,
 * 4:5, 21:9). Selecting a row writes the new width/height back through
 * the editor store. The trigger shows the current dimensions inline so
 * users always know what they're rendering at.
 *
 * Accessibility comes from the underlying `@radix-ui/react-dropdown-menu`
 * primitives wrapped by `components/ui/dropdown-menu`: keyboard nav
 * (arrow keys + Home/End + type-ahead), Escape / outside-click
 * dismissal, focus restoration, ARIA roles. None of that is hand-rolled
 * here.
 */

import { ChevronDown, Square } from "lucide-react";
import { useEditor } from "@/lib/editor/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CanvasOption {
  /** Stable identifier used as the radio-group value. */
  id: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
}

/**
 * Standard canvas dimensions offered by the dropdown. Order is the
 * editor's "obvious first" sequence: landscape → portrait → square →
 * variants. Add new entries here; the dropdown picks them up
 * automatically.
 */
const CANVAS_OPTIONS: readonly CanvasOption[] = [
  { id: "16x9", label: "Landscape", ratio: "16:9", width: 1920, height: 1080 },
  { id: "9x16", label: "Portrait",  ratio: "9:16", width: 1080, height: 1920 },
  { id: "1x1",  label: "Square",    ratio: "1:1",  width: 1080, height: 1080 },
  { id: "4x3",  label: "Standard",  ratio: "4:3",  width: 1440, height: 1080 },
  { id: "4x5",  label: "Vertical",  ratio: "4:5",  width: 1080, height: 1350 },
  { id: "21x9", label: "Cinema",    ratio: "21:9", width: 2560, height: 1080 },
];

/** Identifier used when the canvas matches none of the standard options. */
const CUSTOM_VALUE = "custom";

function matchCanvasOption(canvas: {
  width: number;
  height: number;
}): string {
  const match = CANVAS_OPTIONS.find(
    (o) => o.width === canvas.width && o.height === canvas.height,
  );
  return match?.id ?? CUSTOM_VALUE;
}

export default function CanvasSizeButton() {
  const canvas = useEditor((s) => s.canvas);
  const setCanvas = useEditor((s) => s.setCanvas);

  const currentValue = matchCanvasOption(canvas);

  const handleSelect = (id: string) => {
    const option = CANVAS_OPTIONS.find((o) => o.id === id);
    if (!option) return;
    setCanvas({ width: option.width, height: option.height });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Change canvas size"
          title="Change canvas size"
          className="group inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] font-medium text-white/80 hover:text-white hover:bg-white/[0.06] data-[state=open]:bg-white/[0.06] transition-colors"
        >
          <Square className="size-3.5" strokeWidth={1.75} />
          <span className="hidden sm:inline tabular-nums">
            {canvas.width}×{canvas.height}
          </span>
          <ChevronDown
            /* Inherits open-state via the `group` peer above so the
               caret flips when the menu opens. */
            className="size-3 transition-transform group-data-[state=open]:rotate-180"
            strokeWidth={2}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuRadioGroup
          value={currentValue}
          onValueChange={handleSelect}
        >
          {CANVAS_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              <div className="flex items-center gap-3">
                <RatioPreview width={option.width} height={option.height} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium leading-tight">
                    {option.label}
                  </div>
                  <div className="text-[11px] text-white/55 leading-tight">
                    {option.ratio} · {option.width}×{option.height}
                  </div>
                </div>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 20px-square preview of a ratio, longest side fills the box. */
function RatioPreview({ width, height }: { width: number; height: number }) {
  const BOX = 20;
  const ratio = width / height;
  const w = ratio >= 1 ? BOX : BOX * ratio;
  const h = ratio >= 1 ? BOX / ratio : BOX;
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center"
      style={{ width: BOX, height: BOX }}
    >
      <div
        className="rounded-[2px]"
        style={{
          width: w,
          height: h,
          backgroundColor: "#27292c",
          border: "1px solid rgba(255,255,255,0.18)",
        }}
      />
    </div>
  );
}
