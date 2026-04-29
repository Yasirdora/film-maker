import type { CSSProperties, ReactNode } from "react";

type Heading = "h1" | "h2" | "h3";
type Size = "1" | "2";

type CssVars = Record<`--${string}`, string>;

interface SectionHeadlineProps {
  /** Anchor id (used by jumplinks / sticky nav). */
  id?: string;
  /** Optional gradient treatment defined in components.css. */
  gradient?: "ai" | "apps";
  /** Heading level for the title. Defaults to `h2`. */
  as?: Heading;
  /** Type-scale step (`headline1` or `headline2`). Defaults to `"1"`. */
  size?: Size;
  /** Rendered into the `.headline-icon` slot above the title. */
  icon?: ReactNode;
  /** Small tag rendered above the title. */
  eyebrow?: ReactNode;
  /** Paragraph(s) rendered below the title. */
  body?: ReactNode;
  /**
   * CSS custom properties to apply inline on the headline element.
   * Use for one-off values (e.g. `--title-max-width`) that vary per section.
   */
  cssVars?: CssVars;
  /** Title text/JSX. */
  children: ReactNode;
}

const GRADIENT_CLASS: Record<NonNullable<SectionHeadlineProps["gradient"]>, string> = {
  ai: "headline-gradient-ai",
  apps: "headline-gradient-apps",
};

export default function SectionHeadline({
  id,
  gradient,
  as = "h2",
  size = "1",
  icon,
  eyebrow,
  body,
  cssVars,
  children,
}: SectionHeadlineProps) {
  const Title = as;
  const className = ["headline", "headline-dark", gradient && GRADIENT_CLASS[gradient], "container"]
    .filter(Boolean)
    .join(" ");
  const titleClassName = `headline-title headline${size} markdown`;

  return (
    <div id={id} className={className} style={cssVars as CSSProperties | undefined}>
      <div className="headline-content">
        {icon ? (
          <span className="headline-icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {eyebrow ? (
          <div className="copy-group-eyebrow eyebrow-tag eyebrow-dark eyebrow-outline eyebrow-size">
            {eyebrow}
          </div>
        ) : null}
        <Title className={titleClassName}>{children}</Title>
        {body ? <div className="headline-body body">{body}</div> : null}
      </div>
    </div>
  );
}
