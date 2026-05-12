import type { SVGProps } from "react";

export function ChevronDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M12 5V19M5 12H19"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AccountIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M12 12.5C14.2091 12.5 16 10.7091 16 8.5C16 6.29086 14.2091 4.5 12 4.5C9.79086 4.5 8 6.29086 8 8.5C8 10.7091 9.79086 12.5 12 12.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5 19.5C5 16.4624 8.13401 14 12 14C15.866 14 19 16.4624 19 19.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ProjectsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="5" width="8" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="5" width="8" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="13" width="8" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="13" width="8" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function BurgerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* ------- Tool / menu glyphs (simple line icons in currentColor) ------- */
type IconName =
  | "video-editor"
  | "screen-recorder"
  | "tts"
  | "merge"
  | "trim"
  | "add-audio"
  | "add-image"
  | "add-text"
  | "delogo"
  | "crop"
  | "rotate"
  | "flip"
  | "resize"
  | "loop"
  | "volume"
  | "speed"
  | "stabilize"
  | "recorder"
  | "pitch"
  | "equalizer"
  | "reverse"
  | "voice-recorder"
  | "joiner"
  | "pdf"
  | "convert";

export function ToolIcon({ name, ...rest }: { name: IconName } & SVGProps<SVGSVGElement>) {
  const stroke = "currentColor";
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true as const,
    ...rest,
  };
  switch (name) {
    case "video-editor":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="12" rx="2" stroke={stroke} strokeWidth="1.5" />
          <path d="M10 9.5L15 12L10 14.5V9.5Z" fill={stroke} />
        </svg>
      );
    case "screen-recorder":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="12" rx="2" stroke={stroke} strokeWidth="1.5" />
          <path d="M8 20H16" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="11" r="2" fill={stroke} />
        </svg>
      );
    case "tts":
      return (
        <svg {...common}>
          <path d="M4 9V15H7L12 19V5L7 9H4Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M16 9C17.5 10 17.5 14 16 15" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M19 6.5C21.5 9 21.5 15 19 17.5" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "merge":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="7" height="6" rx="1.2" stroke={stroke} strokeWidth="1.5" />
          <rect x="3" y="13" width="7" height="6" rx="1.2" stroke={stroke} strokeWidth="1.5" />
          <rect x="14" y="9" width="7" height="6" rx="1.2" stroke={stroke} strokeWidth="1.5" />
          <path d="M10 8L14 11M10 16L14 13" stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    case "trim":
      return (
        <svg {...common}>
          <circle cx="6" cy="7" r="2" stroke={stroke} strokeWidth="1.5" />
          <circle cx="6" cy="17" r="2" stroke={stroke} strokeWidth="1.5" />
          <path d="M7.5 8L20 17M7.5 16L20 7" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "add-audio":
      return (
        <svg {...common}>
          <path d="M9 17V7L18 5V15" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="7" cy="17" r="2" stroke={stroke} strokeWidth="1.5" />
          <circle cx="16" cy="15" r="2" stroke={stroke} strokeWidth="1.5" />
          <path d="M3 11H6M4.5 9.5V12.5" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "add-image":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" stroke={stroke} strokeWidth="1.5" />
          <circle cx="9" cy="10" r="1.5" stroke={stroke} strokeWidth="1.5" />
          <path d="M5 17L10 12L14 16L17 13L20 16" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case "add-text":
      return (
        <svg {...common}>
          <path d="M5 7H19M12 7V19" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "delogo":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" stroke={stroke} strokeWidth="1.5" />
          <path d="M8 10L16 14M16 10L8 14" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "crop":
      return (
        <svg {...common}>
          <path d="M7 3V17H21" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M3 7H17V21" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "rotate":
      return (
        <svg {...common}>
          <path d="M4 12C4 7.58 7.58 4 12 4C14.4 4 16.5 5.05 18 6.7" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M18 3V7H14" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 12C20 16.42 16.42 20 12 20C9.6 20 7.5 18.95 6 17.3" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "flip":
      return (
        <svg {...common}>
          <path d="M12 4V20" stroke={stroke} strokeWidth="1.5" strokeDasharray="2 2" />
          <path d="M5 8L10 12L5 16V8Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M19 8L14 12L19 16V8Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case "resize":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="1.5" stroke={stroke} strokeWidth="1.5" />
          <path d="M9 9H15V15" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "loop":
      return (
        <svg {...common}>
          <path d="M17 7H7C5.34 7 4 8.34 4 10C4 11.66 5.34 13 7 13" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14 4L17 7L14 10" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 17H17C18.66 17 20 15.66 20 14C20 12.34 18.66 11 17 11" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 20L7 17L10 14" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "volume":
      return (
        <svg {...common}>
          <path d="M4 9V15H8L13 19V5L8 9H4Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M16 9C18 11 18 13 16 15" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M18 6.5C21 9.5 21 14.5 18 17.5" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "speed":
      return (
        <svg {...common}>
          <path d="M4 14C4 9.58 7.58 6 12 6C16.42 6 20 9.58 20 14" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12 14L16 10" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="14" r="1.5" fill={stroke} />
        </svg>
      );
    case "stabilize":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.5" />
          <circle cx="12" cy="12" r="3" stroke={stroke} strokeWidth="1.5" />
          <path d="M12 4V7M12 17V20M4 12H7M17 12H20" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "recorder":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="14" height="12" rx="2" stroke={stroke} strokeWidth="1.5" />
          <path d="M17 10L21 7V17L17 14" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case "pitch":
      return (
        <svg {...common}>
          <path d="M4 19V13C4 9 7 5 12 5C17 5 20 9 20 13V19" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M9 13L11 11L13 15L15 12" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "equalizer":
      return (
        <svg {...common}>
          <path d="M6 4V20M6 8H4M6 8H8" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12 4V20M12 13H10M12 13H14" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M18 4V20M18 17H16M18 17H20" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "reverse":
      return (
        <svg {...common}>
          <path d="M11 6L4 12L11 18V6Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M20 6L13 12L20 18V6Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case "voice-recorder":
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="12" rx="3" stroke={stroke} strokeWidth="1.5" />
          <path d="M5 11C5 14.87 8.13 18 12 18C15.87 18 19 14.87 19 11" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12 18V21" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "joiner":
      return (
        <svg {...common}>
          <path d="M3 12H10C11 12 11 9 12 9C13 9 13 15 14 15C15 15 15 12 16 12H21" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "pdf":
      return (
        <svg {...common}>
          <path d="M6 3H14L19 8V21H6V3Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M14 3V8H19" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 13H10C11 13 11 15 10 15H9V13Z" fill={stroke} />
        </svg>
      );
    case "convert":
      return (
        <svg {...common}>
          <path d="M4 8H17" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14 5L17 8L14 11" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 16H7" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 13L7 16L10 19" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

export function UndoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M3.5 5.5H9.5C11.157 5.5 12.5 6.843 12.5 8.5C12.5 10.157 11.157 11.5 9.5 11.5H5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 3L3 5.5L5.5 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RedoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M12.5 5.5H6.5C4.843 5.5 3.5 6.843 3.5 8.5C3.5 10.157 4.843 11.5 6.5 11.5H10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 3L13 5.5L10.5 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GoogleGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M22.5 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.22-4.74 3.22-8.32z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.16v2.84C3.97 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.85 14.1c-.22-.66-.34-1.36-.34-2.1s.12-1.44.34-2.1V7.06H2.16C1.42 8.55 1 10.22 1 12s.42 3.45 1.16 4.94l3.69-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.5c1.62 0 3.07.56 4.21 1.64l3.16-3.16C17.46 2.2 14.97 1 12 1 7.7 1 3.97 3.47 2.16 7.06l3.69 2.84C6.71 7.43 9.14 5.5 12 5.5z"
      />
    </svg>
  );
}

export function FilmmakerBrandMark(props: SVGProps<SVGSVGElement>) {
  // Clapperboard icon + "FILMMAKER" wordmark
  return (
    <svg
      width="130"
      height="22"
      viewBox="0 0 130 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Filmmaker"
      {...props}
    >
      {/* Clapperboard base */}
      <rect
        fill="#ffffff"
        x="2"
        y="10"
        width="14"
        height="10"
        rx="1"
      />
      {/* Clapperboard top arm (hinged, slightly open) */}
      <path
        fill="#ffffff"
        d="M2.5,10 L15.5,10 C16,10 16.3,9.7 16.3,9.3 L16.3,6.5 C16.3,6.1 16,5.8 15.5,5.8 L2.8,5.8 C2.4,5.8 2.1,6 2,6.3 L1.8,9.3 C1.8,9.7 2.1,10 2.5,10 Z"
        transform="rotate(-12, 2.5, 10)"
      />
      {/* Wordmark */}
      <text
        x="22"
        y="17"
        fill="#ffffff"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="13"
        fontWeight="700"
        letterSpacing="0.8"
      >
        FILMMAKER
      </text>
    </svg>
  );
}
