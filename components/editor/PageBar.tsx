"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageBarProps {
  /**
   * Breadcrumb trail. The last item is treated as the current page —
   * rendered as plain text with `aria-current="page"`, never a link.
   */
  breadcrumbs: BreadcrumbItem[];
  /**
   * Small status badge appended after the current-page label, e.g. "BETA".
   * Omit for production-ready pages.
   */
  badge?: string;
  /**
   * Page-level kebab slot, rendered immediately after the badge. Each
   * editor uses this for tool-specific page actions (clear project,
   * recent files, etc.) — see `<PageKebabMenu>` in
   * `components/editor/shared`.
   */
  pageMenu?: ReactNode;
  /**
   * Slot rendered after the kebab — typically a compact tool row
   * (select / range / blade, undo/redo group, etc.).
   */
  leadingActions?: ReactNode;
  /**
   * Right-aligned slot for page-specific UI: toolbar buttons, a kebab menu,
   * page-level actions. Rendered inside a flex row so callers can pass any
   * sequence of buttons / icons.
   */
  actions?: ReactNode;
}

/**
 * PageBar — per-page breadcrumb + actions row used by the editor module.
 *
 * Sits flush beneath the global `<AppNav />` (mounted by
 * `app/editor/layout.tsx`). Each editor page mounts this with its own
 * trail and (optionally) tool buttons. Keeping it page-owned avoids
 * forcing the layout to know about every editor's toolbar.
 *
 * Visual contract: horizontal padding `px-4 sm:px-8` to align with the
 * rest of the editor chrome, and a hairline bottom border so the page
 * content reads as a separate region below.
 */
export default function PageBar({
  breadcrumbs,
  badge,
  pageMenu,
  leadingActions,
  actions,
}: PageBarProps) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-8 py-2 sm:py-2.5">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-[12px] sm:text-[13px] text-[#5c5c60] min-w-0"
        >
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            // On mobile (<md) only the current-page crumb is shown — parent
            // crumbs and their "/" separators collapse to keep the bar tight.
            const hideOnMobile = !isLast;
            return (
              <Fragment key={`${crumb.label}-${i}`}>
                {i > 0 && (
                  <span
                    aria-hidden
                    className={`text-[#3a3a3e] ${hideOnMobile ? "hidden md:inline" : ""}`}
                  >
                    /
                  </span>
                )}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className={`truncate hover:text-white transition-colors ${hideOnMobile ? "hidden md:inline" : ""}`}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? "page" : undefined}
                    className={`truncate ${isLast ? "text-white" : ""} ${hideOnMobile ? "hidden md:inline" : ""}`}
                  >
                    {crumb.label}
                  </span>
                )}
                {isLast && badge && <PageBadge label={badge} />}
              </Fragment>
            );
          })}
        </nav>
        {pageMenu && (
          <div className="flex items-center shrink-0 -ml-0.5">{pageMenu}</div>
        )}
        {leadingActions && (
          <div className="flex items-center shrink-0">{leadingActions}</div>
        )}
        {actions && (
          <div className="ml-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

function PageBadge({ label }: { label: string }) {
  return (
    <span
      className="ml-1.5 inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-semibold tracking-wider uppercase"
      style={{
        backgroundColor: "#1c1c1f",
        color: "#8e8e93",
        borderColor: "#26262a",
      }}
    >
      {label}
    </span>
  );
}
