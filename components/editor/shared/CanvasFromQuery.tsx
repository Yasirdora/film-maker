"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useEditor } from "@/lib/editor/store";

export default function CanvasFromQuery() {
  const params = useSearchParams();
  const setCanvas = useEditor((s) => s.setCanvas);
  useEffect(() => {
    const w = parseInt(params.get("w") ?? "");
    const h = parseInt(params.get("h") ?? "");
    if (w > 0 && h > 0) setCanvas({ width: w, height: h });
  }, [params, setCanvas]);
  return null;
}
