"use client";

/**
 * LandingHeaderShell — client-side body of the landing-page header.
 *
 * Renders the inline `header-content` row: logo, nav links, right slot.
 * No mobile burger / slide-in panel — the link row is shown at every
 * breakpoint (CSS handles the spacing). Right-side CTA is supplied by
 * the server component as a React node so session-bound data stays
 * server-side.
 */

import { useCallback, useRef, type ReactNode } from "react";
import Link from "next/link";

import {
    ClapperboardIcon,
    type ClapperboardIconHandle,
} from "./icons/clapperboard-icon";

interface NavLink {
    label: string;
    href: string;
    active: boolean;
}

export function LandingHeaderShell({
    navLinks,
    rightSlot,
}: {
    navLinks: readonly NavLink[];
    rightSlot: ReactNode;
}) {
    const logoRef = useRef<ClapperboardIconHandle>(null);
    const clap = useCallback(() => logoRef.current?.clap(), []);

    return (
        <div className="header-content">
            <Link
                className="header-logo-anchor"
                href="/"
                aria-label="Film-maker — home"
                onMouseEnter={clap}
            >
                <ClapperboardIcon
                    ref={logoRef}
                    autoClap
                    className="header-logo-wordmark"
                />
            </Link>

            <nav className="header-links header-links-links">
                <ul className="unstyled">
                    {navLinks.map((link) => (
                        <li key={link.label}>
                            <Link
                                className={`header-link header-link-link${
                                    link.active ? " header-link-active" : ""
                                }`}
                                href={link.href}
                            >
                                {link.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="header-cta header-cta-cta">{rightSlot}</div>
        </div>
    );
}
