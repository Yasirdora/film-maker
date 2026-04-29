"use client";

/**
 * LandingHeaderShell — client-side body of the landing-page header.
 *
 * Owns the mobile burger/menu state and renders both the in-line
 * `header-content` row and the slide-in `header-mobile-menu` panel.
 * The `<header>` chrome and right-side button are passed in from the
 * server component (`LandingHeader`) as a React node so session-bound
 * data stays on the server.
 *
 * Layout/markup is a verbatim port of google-one-next's Header.tsx;
 * only the right-slot CTA differs.
 */

import { useCallback, useRef, useState, type ReactNode } from "react";
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
    const [menuOpen, setMenuOpen] = useState(false);
    const openMenu = useCallback(() => setMenuOpen(true), []);
    const closeMenu = useCallback(() => setMenuOpen(false), []);

    const inlineLogoRef = useRef<ClapperboardIconHandle>(null);
    const menuLogoRef = useRef<ClapperboardIconHandle>(null);
    const clapInline = useCallback(() => inlineLogoRef.current?.clap(), []);
    const clapMenu = useCallback(() => menuLogoRef.current?.clap(), []);

    return (
        <>
            <div className="header-content">
                <div className="header-burger header-burger-burger">
                    <button
                        className="header-circle-button"
                        data-slot="burger"
                        aria-label="Open nav menu"
                        onClick={openMenu}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            height="20"
                            viewBox="0 -960 960 960"
                            width="20"
                        >
                            <path
                                d="M144-264v-72h672v72H144Zm0-180v-72h672v72H144Zm0-180v-72h672v72H144Z"
                                fill="currentColor"
                            />
                        </svg>
                    </button>
                </div>

                <Link
                    className="header-logo-anchor"
                    href="/"
                    aria-label="Film-maker — home"
                    onMouseEnter={clapInline}
                >
                    <ClapperboardIcon
                        ref={inlineLogoRef}
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

            <div
                className="header-mobile-menu header-mobile-menu-mobileMenu"
                role="navigation"
                data-slot="menu"
                {...(menuOpen ? {} : { inert: true })}
                style={menuOpen ? { transform: "translateX(0)" } : undefined}
            >
                <div className="header-mobile-menu-header header-mobile-menu-header-mobileMenuHeader">
                    <Link
                        className="header-logo-anchor"
                        href="/"
                        aria-label="Film-maker — home"
                        onMouseEnter={clapMenu}
                    >
                        <ClapperboardIcon
                            ref={menuLogoRef}
                            className="header-logo-wordmark"
                        />
                    </Link>
                    <button
                        className="header-circle-button"
                        data-slot="close"
                        aria-label="Close nav menu"
                        onClick={closeMenu}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            height="20"
                            viewBox="0 -960 960 960"
                            width="20"
                        >
                            <path
                                d="m291-240-51-51 189-189-189-189 51-51 189 189 189-189 51 51-189 189 189 189-51 51-189-189-189 189Z"
                                fill="currentColor"
                            />
                        </svg>
                    </button>
                </div>

                <div className="header-mobile-menu-links">
                    <ul className="unstyled">
                        {navLinks.map((link) => (
                            <li key={link.label}>
                                <Link
                                    className={`header-mobile-menu-link header-mobile-menu-link-mobileMenuLink${
                                        link.active ? " header-link-active" : ""
                                    }`}
                                    href={link.href}
                                    onClick={closeMenu}
                                >
                                    <span>{link.label}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="header-mobile-menu-footer">
                    <div className="header-mobile-menu-footer-cta">
                        {rightSlot}
                    </div>
                </div>
            </div>
        </>
    );
}
