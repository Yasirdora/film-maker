"use client";

/**
 * CanvasSizeModal — picker for video canvas dimensions.
 *
 * Decoupled from any callsite-specific action: the parent supplies an
 * `onSelect(width, height)` callback fired when the user confirms a size.
 * Single-click selects; double-click confirms; the "Confirm" footer button
 * confirms the current selection. Pre-selection is driven by `current`
 * (matched against the option list) so the modal opens highlighting the
 * size the user already has.
 */

import { useEffect, useMemo, useState } from "react";
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

/**
 * Finds the index of the option matching the given dimensions exactly.
 * Falls back to 0 (Landscape 16:9) when no match — the canonical default.
 */
function indexFromCurrent(current?: { width: number; height: number }): number {
    if (!current) return 0;
    const i = OPTIONS.findIndex(
        (o) => o.width === current.width && o.height === current.height,
    );
    return i >= 0 ? i : 0;
}

export default function CanvasSizeModal({
    open,
    onClose,
    onSelect,
    title = "Canvas size",
    confirmLabel = "Apply",
    current,
}: {
    open: boolean;
    onClose: () => void;
    onSelect: (width: number, height: number) => void;
    /** Modal heading — caller-customizable so "create project" and "change
     *  size" can each phrase the action appropriately. */
    title?: string;
    /** Footer button copy — matches the surrounding action. */
    confirmLabel?: string;
    /** Currently active canvas size; used to pre-select the matching tile. */
    current?: { width: number; height: number };
}) {
    const initialIdx = useMemo(() => indexFromCurrent(current), [current]);
    const [selectedIdx, setSelectedIdx] = useState(initialIdx);

    // Re-sync the selection when the modal is re-opened with a new
    // `current`. Setting state from a non-React signal (the parent's open
    // toggle) is what makes this a legitimate effect, even though the
    // lint rule errs on the strict side for unconditional writes.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (open) setSelectedIdx(initialIdx);
    }, [open, initialIdx]);

    function confirm() {
        const { width, height } = OPTIONS[selectedIdx];
        onSelect(width, height);
        onClose();
    }

    return (
        <Modal open={open} onClose={onClose} labelledBy="canvas-size-title">
            <ModalPanel className="w-full max-w-[560px]">
                <ModalHeader>
                    <h2
                        id="canvas-size-title"
                        className="text-[15px] font-medium text-white"
                    >
                        {title}
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
                            const { width, height } = previewSize(
                                option.width,
                                option.height,
                            );
                            return (
                                <button
                                    key={option.label}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => setSelectedIdx(i)}
                                    onDoubleClick={confirm}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border bg-[#16171a] hover:bg-[#1c1d20] transition-colors ${
                                        selected
                                            ? "border-[#2962ff]"
                                            : "border-[#252629]"
                                    }`}
                                >
                                    <div
                                        className="bg-[#27292c] border border-[#3a3b3f] rounded"
                                        style={{ width, height }}
                                    />
                                    <div className="text-center">
                                        <div className="text-[13px] text-white">
                                            {option.label}
                                        </div>
                                        <div className="text-[11px] text-[#95979c]">
                                            {option.ratio}
                                        </div>
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
                        onClick={confirm}
                        className="h-9 px-4 rounded-[3px] text-[13px] font-medium text-white bg-[#2962ff] hover:bg-[#104fff]"
                    >
                        {confirmLabel}
                    </button>
                </ModalFooter>
            </ModalPanel>
        </Modal>
    );
}
