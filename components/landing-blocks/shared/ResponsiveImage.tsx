type Breakpoint = "sm" | "md" | "lg" | "xl" | "all";

interface BreakpointSource {
  breakpoint: Breakpoint;
  src: string;
  srcSet2x: string;
  srcSet1x: string;
  width: number;
  height: number;
}

interface ResponsiveImageProps {
  sources: BreakpointSource[];
  alt: string;
}

const BREAKPOINT_CLASSES: Record<Breakpoint, string> = {
  all: "image breakpoint-all",
  sm: "image breakpoint-sm",
  md: "image breakpoint-md",
  lg: "image breakpoint-lg",
  xl: "image breakpoint-xl",
};

export default function ResponsiveImage({ sources, alt }: ResponsiveImageProps) {
  return (
    <>
      {sources.map((s) => (
        <picture key={s.breakpoint} className={BREAKPOINT_CLASSES[s.breakpoint]}>
          <source srcSet={`${s.srcSet2x} 2x, ${s.srcSet1x}`} />
          <img
            src={s.src}
            width={s.width}
            height={s.height}
            alt={alt}
            loading="lazy"
          />
        </picture>
      ))}
    </>
  );
}
