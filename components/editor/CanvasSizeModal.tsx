"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CloseIcon } from "./Icons";
import { Modal, ModalBody, ModalFooter, ModalHeader, ModalPanel } from "./Modal";

type CanvasOption = {
  label: string;
  ratio: string;
  width: number;
  height: number;
};

const OPTIONS: CanvasOption[] = [
  { label: "Landscape", ratio: "16:9", width: 1920, height: 1080 },
  { label: "Portrait", ratio: "9:16", width: 1080, height: 1920 },
  { label: "Square", ratio: "1:1", width: 1080, height: 1080 },
  { label: "Standard", ratio: "4:3", width: 1440, height: 1080 },
  { label: "Vertical 4:5", ratio: "4:5", width: 1080, height: 1350 },
  { label: "Cinema", ratio: "21:9", width: 2560, height: 1080 },
];

const PREVIEW_MAX = 64;

function previewSize(width: number, height: number) {
  const ratio = width / height;
  return ratio >= 1
    ? { width: PREVIEW_MAX, height: PREVIEW_MAX / ratio }
    : { width: PREVIEW_MAX * ratio, height: PREVIEW_MAX };
}

export default function CanvasSizeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [selectedIdx, setSelectedIdx] = useState(0);

  function createProject() {
    const { width, height } = OPTIONS[selectedIdx];
    router.push(`/editor/video?w=${width}&h=${height}`);
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="canvas-size-title">
      <ModalPanel className="w-full max-w-[560px]">
        <ModalHeader>
          <h2 id="canvas-size-title" className="text-[15px] font-medium text-white">
            Choose a canvas size for the new project
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[#95979c] hover:text-white"
          >
            <CloseIcon />
          </button>
        </ModalHeader>

        <ModalBody>
          <div
            role="radiogroup"
            aria-labelledby="canvas-size-title"
            className="grid grid-cols-3 gap-3"
          >
            {OPTIONS.map((option, i) => {
              const selected = selectedIdx === i;
              const { width, height } = previewSize(option.width, option.height);
              return (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSelectedIdx(i)}
                  onDoubleClick={createProject}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border bg-[#16171a] hover:bg-[#1c1d20] transition-colors ${
                    selected ? "border-[#2962ff]" : "border-[#252629]"
                  }`}
                >
                  <div
                    className="bg-[#27292c] border border-[#3a3b3f] rounded"
                    style={{ width, height }}
                  />
                  <div className="text-center">
                    <div className="text-[13px] text-white">{option.label}</div>
                    <div className="text-[11px] text-[#95979c]">{option.ratio}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </ModalBody>

        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] text-[#d9dce3] hover:bg-[#27292c]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={createProject}
            className="h-9 px-4 rounded-[3px] text-[13px] font-medium text-white bg-[#2962ff] hover:bg-[#104fff]"
          >
            Create project
          </button>
        </ModalFooter>
      </ModalPanel>
    </Modal>
  );
}
