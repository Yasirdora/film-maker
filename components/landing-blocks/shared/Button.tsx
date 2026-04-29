import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { ArrowIcon, OpenInNewIcon } from "./icons";

export type ButtonVariant = "primary" | "tonal" | "link";
export type ButtonIcon = "arrow" | "external";

interface CommonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  icon?: ButtonIcon;
  ariaLabel?: string;
  className?: string;
}

interface AnchorProps extends CommonProps {
  href: string;
  external?: boolean;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  type?: never;
}

interface ButtonElProps extends CommonProps {
  href?: undefined;
  external?: never;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit" | "reset";
}

type Props = AnchorProps | ButtonElProps;

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "button button-high-emphasis button-high-emphasis-theme-dark button-inner button-high-emphasis-variant-high-emphasis",
  tonal:
    "button button-tonal button-high-emphasis-theme-dark button-inner button-tonal-variant-tonal",
  link: "button-inner button-link",
};

const ICON_CLASS: Record<ButtonIcon, string> = {
  arrow: "button-with-right-icon button-arrow-forward",
  external: "button-with-right-icon button-open-in-new",
};

function RightIcon({ icon }: { icon: ButtonIcon }) {
  return (
    <div className="button-right-icon button-right-icon-rightIcon">
      {icon === "arrow" ? <ArrowIcon /> : <OpenInNewIcon />}
    </div>
  );
}

/**
 * Unified button for all CTAs. Renders an <a> when `href` is provided,
 * otherwise a <button>. Variants map to design-system class chains.
 */
export default function Button(props: Props) {
  const { variant = "primary", icon, children, ariaLabel, className } = props;

  const classes = [VARIANT_CLASS[variant], icon && ICON_CLASS[icon], className]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <div className="button-label">{children}</div>
      {icon && <RightIcon icon={icon} />}
    </>
  );

  if (props.href !== undefined) {
    const externalAttrs = props.external
      ? { target: "_blank" as const, rel: "noopener noreferrer" }
      : {};
    const isInternalRoute =
      !props.external && props.href.startsWith("/") && !props.href.startsWith("//");
    if (isInternalRoute) {
      return (
        <Link
          href={props.href}
          aria-label={ariaLabel}
          className={classes}
          onClick={props.onClick}
        >
          {content}
        </Link>
      );
    }
    return (
      <a
        href={props.href}
        aria-label={ariaLabel}
        className={classes}
        onClick={props.onClick}
        {...externalAttrs}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      aria-label={ariaLabel}
      className={classes}
      onClick={props.onClick}
    >
      {content}
    </button>
  );
}
