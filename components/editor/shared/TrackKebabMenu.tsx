"use client";

import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import Popover from "./Popover";
import { MoreVert } from "./icons";

export type TrackKebabMenuProps = {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRename: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onImportFromDisk: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export default function TrackKebabMenu(props: TrackKebabMenuProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  const act = useCallback(
    (fn: () => void) => (e: MouseEvent) => {
      e.stopPropagation();
      close();
      fn();
    },
    [close],
  );

  /* Auto-focus first focusable item when popover mounts. */
  const focusFirst = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const first = node.querySelector<HTMLElement>(
      "[role='menuitem']:not([aria-disabled])",
    );
    first?.focus();
  }, []);

  /* Trap Tab/Shift+Tab inside the menu. */
  const onMenuKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>(
        "[role='menuitem']:not([aria-disabled])",
      ),
    );
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey
      ? (idx - 1 + items.length) % items.length
      : (idx + 1) % items.length;
    items[next].focus();
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Track options"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Track options"
        className="ae-icon-btn"
        data-active={open || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVert width={16} height={16} />
      </button>

      <Popover
        open={open}
        anchorRef={triggerRef}
        onClose={close}
        offset={6}
        placement="bottom-end"
      >
        <div
          ref={focusFirst}
          role="menu"
          onKeyDown={onMenuKeyDown}
          style={{
            minWidth: 240,
            background: "#161616",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12,
            padding: 4,
            boxShadow:
              "0 16px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
            color: "white",
            fontSize: 13,
            userSelect: "none",
            outline: "none",
          }}
        >
          <MenuItem onSelect={act(props.onRename)}>Rename</MenuItem>

          <Divider />

          <MenuItem disabled>Enable Recording</MenuItem>

          <Divider />

          <MenuItem onSelect={act(props.onMoveUp)} disabled={!props.canMoveUp}>
            Move Up
          </MenuItem>
          <MenuItem onSelect={act(props.onMoveDown)} disabled={!props.canMoveDown}>
            Move Down
          </MenuItem>

          <Divider />

          <MenuItem onSelect={act(props.onImportFromDisk)}>
            Import from Disk
          </MenuItem>
          <MenuItem disabled>Export as Audio</MenuItem>

          <Divider />

          <MenuItem onSelect={act(props.onDuplicate)} shortcut="⇧D">
            Duplicate
          </MenuItem>
          <MenuItem onSelect={act(props.onDelete)} shortcut="⇧⌫" danger>
            Delete
          </MenuItem>
        </div>
      </Popover>
    </>
  );
}

/* ── Primitives ───────────────────────────────────────────────────── */

function Divider() {
  return (
    <div
      role="separator"
      style={{
        height: 1,
        margin: "4px 6px",
        background: "rgba(255,255,255,0.07)",
      }}
    />
  );
}

type MenuItemProps = {
  onSelect?: (e: MouseEvent) => void;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
};

function MenuItem({ onSelect, shortcut, disabled, danger, children }: MenuItemProps) {
  const [hovered, setHovered] = useState(false);

  const color = disabled
    ? "rgba(255,255,255,0.3)"
    : danger
      ? "#ff453a"
      : "white";

  return (
    <button
      role="menuitem"
      type="button"
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onSelect}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        gap: 16,
        padding: "7px 10px",
        borderRadius: 7,
        border: "none",
        background: hovered ? "rgba(255,255,255,0.09)" : "transparent",
        color,
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        font: "inherit",
        fontSize: 13,
        outline: "none",
        transition: "background 0.08s",
        boxSizing: "border-box",
      }}
    >
      <span>{children}</span>
      {shortcut && <Shortcut value={shortcut} danger={danger} />}
    </button>
  );
}

/* ── Keyboard shortcut display ────────────────────────────────────────
   Plain inline text/icons (macOS native menu style). Special glyphs
   render as inline SVGs because the unicode chars ⇧ (U+21E7), ⌫ (U+232B)
   etc. are missing from most fonts and the browser substitutes a
   poorly-weighted symbol-font fallback. */

function Shortcut({ value, danger }: { value: string; danger?: boolean }) {
  const tokens = parseShortcut(value);
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        flexShrink: 0,
        color: danger ? "rgba(255, 120, 100, 0.75)" : "rgba(255,255,255,0.45)",
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: 0.3,
      }}
    >
      {tokens.map((tok, i) =>
        tok.kind === "icon" ? (
          <span key={i} style={{ display: "inline-flex" }}>
            {renderShortcutIcon(tok.value)}
          </span>
        ) : (
          <span key={i}>{tok.value}</span>
        ),
      )}
    </span>
  );
}

type ShortcutIconName =
  | "shift"
  | "backspace"
  | "cmd"
  | "option"
  | "control"
  | "return";

type ShortcutToken =
  | { kind: "icon"; value: ShortcutIconName }
  | { kind: "text"; value: string };

function parseShortcut(s: string): ShortcutToken[] {
  const out: ShortcutToken[] = [];
  for (const ch of s) {
    switch (ch) {
      case "⇧": out.push({ kind: "icon", value: "shift" }); break;
      case "⌫": out.push({ kind: "icon", value: "backspace" }); break;
      case "⌘": out.push({ kind: "icon", value: "cmd" }); break;
      case "⌥": out.push({ kind: "icon", value: "option" }); break;
      case "⌃": out.push({ kind: "icon", value: "control" }); break;
      case "⏎": out.push({ kind: "icon", value: "return" }); break;
      default:
        if (ch.trim()) out.push({ kind: "text", value: ch.toUpperCase() });
    }
  }
  return out;
}

function renderShortcutIcon(name: ShortcutIconName) {
  const stroke = "currentColor";
  const sw = 1.4;
  const common = {
    fill: "none" as const,
    stroke,
    strokeWidth: sw,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  };
  switch (name) {
    case "shift":
      return (
        <svg width="11" height="11" viewBox="0 0 14 14" {...common}>
          <path d="M7 2.25L11.75 7H9.5V11.75H4.5V7H2.25L7 2.25Z" />
        </svg>
      );
    case "backspace":
      return (
        <svg width="13" height="10" viewBox="0 0 16 12" {...common}>
          <path d="M5.5 1.5H14V10.5H5.5L2 6Z" />
          <path d="M8.5 4.75L11.5 7.75M11.5 4.75L8.5 7.75" />
        </svg>
      );
    case "cmd":
      return (
        <svg width="11" height="11" viewBox="0 0 14 14" {...common}>
          <rect x="4.5" y="4.5" width="5" height="5" />
          <circle cx="2.5" cy="2.5" r="1.5" />
          <circle cx="11.5" cy="2.5" r="1.5" />
          <circle cx="2.5" cy="11.5" r="1.5" />
          <circle cx="11.5" cy="11.5" r="1.5" />
        </svg>
      );
    case "option":
      return (
        <svg width="11" height="9" viewBox="0 0 14 12" {...common}>
          <path d="M0.75 2H4.5L9 10H13.25" />
          <path d="M8 2H13.25" />
        </svg>
      );
    case "control":
      return (
        <svg width="11" height="7" viewBox="0 0 14 8" {...common}>
          <path d="M1.25 6L7 1.75L12.75 6" />
        </svg>
      );
    case "return":
      return (
        <svg width="11" height="9" viewBox="0 0 14 12" {...common}>
          <path d="M12.25 2V6.5H3" />
          <path d="M5.5 4L3 6.5L5.5 9" />
        </svg>
      );
  }
}

