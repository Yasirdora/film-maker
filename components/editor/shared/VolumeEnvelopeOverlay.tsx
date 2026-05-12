import { EnvelopePoint } from "@/lib/editor/types";
import { useEditor } from "@/lib/editor/store";
import { useState } from "react";

export default function VolumeEnvelopeOverlay({
  clipId,
  points = [],
  duration,
  width,
  height,
}: {
  clipId: string;
  points?: EnvelopePoint[];
  duration: number;
  width: number;
  height: number;
}) {
  const updateClip = useEditor((s) => s.updateClip);
  const _pushHistory = useEditor((s) => s._pushHistory);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Math conversions
  const valToY = (val: number) => {
    // 0 -> height (bottom), 1 -> height/2, 2 -> 0 (top)
    return height - (Math.min(2, Math.max(0, val)) / 2) * height;
  };
  const yToVal = (y: number) => {
    return Math.max(0, Math.min(2, 2 * (1 - y / height)));
  };
  const timeToX = (time: number) => {
    return (time / duration) * width;
  };
  const xToTime = (x: number) => {
    return Math.max(0, Math.min(duration, (x / width) * duration));
  };

  const handleSvgMouseDown = (e: React.MouseEvent) => {
    // Prevent creating a point if we clicked on a point handle (which has its own handler)
    if ((e.target as SVGElement).tagName === "circle") return;

    e.stopPropagation();
    e.preventDefault();
    _pushHistory();

    const targetEl = e.currentTarget as SVGSVGElement;
    const rect = targetEl.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    const newTime = xToTime(startX);
    const newVal = yToVal(startY);

    const newPoint = { time: newTime, value: newVal };
    const basePoints = [...points, newPoint].sort((a, b) => a.time - b.time);
    const newIdx = basePoints.indexOf(newPoint);

    updateClip(clipId, { volumePoints: basePoints });
    setDraggingIdx(newIdx);

    // Immediately start dragging the newly created point
    const move = (ev: MouseEvent) => {
      const currentRect = targetEl.getBoundingClientRect();
      const moveX = ev.clientX - currentRect.left;
      const moveY = ev.clientY - currentRect.top;

      let mt = xToTime(moveX);
      const mv = yToVal(moveY);

      const prev = basePoints[newIdx - 1];
      const next = basePoints[newIdx + 1];
      if (prev && mt <= prev.time) mt = prev.time + 0.001;
      if (next && mt >= next.time) mt = next.time - 0.001;

      const updatedPoints = [...basePoints];
      updatedPoints[newIdx] = { time: mt, value: mv };
      updateClip(clipId, { volumePoints: updatedPoints });
    };

    const up = () => {
      setDraggingIdx(null);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const startDragPoint = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    e.preventDefault();
    _pushHistory();

    setDraggingIdx(idx);

    // Capture the SVG element immediately since e.currentTarget is cleared by React after the event cycle
    const targetEl = (e.currentTarget as SVGElement).parentNode as SVGSVGElement;

    const move = (ev: MouseEvent) => {
      // Find relative position
      if (!targetEl) return;
      const rect = targetEl.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;

      let newTime = xToTime(x);
      const newVal = yToVal(y);

      // Constraints
      const prev = points[idx - 1];
      const next = points[idx + 1];
      if (prev && newTime <= prev.time) newTime = prev.time + 0.001;
      if (next && newTime >= next.time) newTime = next.time - 0.001;

      const newPoints = [...points];
      newPoints[idx] = { time: newTime, value: newVal };
      updateClip(clipId, { volumePoints: newPoints });
    };

    const up = () => {
      setDraggingIdx(null);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const handleDoubleClickPoint = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    e.preventDefault();
    _pushHistory();

    const newPoints = points.filter((_, i) => i !== idx);
    updateClip(clipId, { volumePoints: newPoints });
  };

  // Build the polyline points
  const drawPoints = points.length === 0 ? [] : [...points];
  let polylineD = "";

  if (drawPoints.length === 0) {
    // Flat line at native volume (value 1)
    polylineD = `M 0 ${valToY(1)} L ${width} ${valToY(1)}`;
  } else {
    // Start with a point at the beginning if needed
    if (drawPoints[0].time > 0) {
      polylineD += `M 0 ${valToY(drawPoints[0].value)} `;
    } else {
      polylineD += `M ${timeToX(drawPoints[0].time)} ${valToY(drawPoints[0].value)} `;
    }

    drawPoints.forEach((p) => {
      polylineD += `L ${timeToX(p.time)} ${valToY(p.value)} `;
    });

    // End with a point at the end if needed
    if (drawPoints[drawPoints.length - 1].time < duration) {
      polylineD += `L ${width} ${valToY(drawPoints[drawPoints.length - 1].value)}`;
    }
  }

  return (
    <svg
      width={width}
      height={height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 10, // above waveform, below trim handles
        cursor: "crosshair",
      }}
      onMouseDown={handleSvgMouseDown}
    >
      <path
        d={polylineD}
        fill="none"
        stroke="rgba(255, 255, 255, 0.8)"
        strokeWidth="1.5"
      />

      {points.map((p, i) => (
        <circle
          key={i}
          cx={timeToX(p.time)}
          cy={valToY(p.value)}
          r={hoveredIdx === i || draggingIdx === i ? 5 : 3.5}
          fill="rgba(255, 255, 255, 1)"
          stroke="rgba(0, 0, 0, 0.8)"
          strokeWidth="1.5"
          style={{ cursor: "pointer", pointerEvents: "all" }}
          onMouseEnter={() => setHoveredIdx(i)}
          onMouseLeave={() => setHoveredIdx(null)}
          onMouseDown={(e) => startDragPoint(e, i)}
          onDoubleClick={(e) => handleDoubleClickPoint(e, i)}
        />
      ))}
      
      {/* Optional: Show dB hint when hovering or dragging */}
      {(hoveredIdx !== null || draggingIdx !== null) && (
        <g pointerEvents="none">
           {(() => {
              const idx = draggingIdx !== null ? draggingIdx : hoveredIdx;
              if (idx === null || !points[idx]) return null;
              const p = points[idx];
              const cx = timeToX(p.time);
              const cy = valToY(p.value);
              const label = p.value === 0 ? "-∞ dB" : `${Math.round(20 * Math.log10(p.value))} dB`;
              
              return (
                <g transform={`translate(${cx}, ${cy - 12})`}>
                  <rect x="-24" y="-14" width="48" height="18" rx="4" fill="rgba(0,0,0,0.85)" />
                  <text x="0" y="-1" fill="white" fontSize="10" textAnchor="middle" fontWeight="500">
                    {label}
                  </text>
                </g>
              );
           })()}
        </g>
      )}
    </svg>
  );
}
