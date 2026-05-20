/**
 * Artistic Intelligence sidebar.
 *
 * Layout (top-to-bottom, vertically stacked, 220 px wide):
 *
 *   1. Mode navigation (Chat / Script / Storyboard)
 *   2. "New chat" button
 *   3. "Chat history" section header (clock icon)
 *   4. Conversation list with hover/active states and contextual menu
 *
 * On mobile the same shell is reused inside a slide-over drawer.
 */

"use client";

import * as React from "react";
import { formatTimeAgo } from "@/lib/utils";
import type { ArtisticIntelligenceMode } from "@/lib/artistic-intelligence";
import { AppBrandMark } from "@/components/app-brand-mark";
import { ModeNav } from "./mode-switcher";
import styles from "./artistic-intelligence.module.css";

export interface SidebarConversation {
    id: string;
    title: string;
    mode: ArtisticIntelligenceMode;
    updatedAt: number;
    isAnonymous: boolean;
    pinnedAt: number | null;
    archivedAt: number | null;
}

interface ArtisticIntelligenceSidebarProps {
    mode: ArtisticIntelligenceMode;
    onModeChange: (next: ArtisticIntelligenceMode) => void;
    unlockedModes: ReadonlySet<ArtisticIntelligenceMode>;
    onLockedMode?: (locked: ArtisticIntelligenceMode) => void;
    conversations: SidebarConversation[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onNewChat: () => void;
    onDelete?: (id: string, confirmed?: boolean) => void;
    onRename?: (id: string) => void;
    confirmingDeleteId?: string | null;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    mobileOpen?: boolean;
}

const PLACEHOLDER_TITLE = "Drafting…";

export function ArtisticIntelligenceSidebar({
    mode,
    onModeChange,
    unlockedModes,
    onLockedMode,
    conversations,
    activeId,
    onSelect,
    onNewChat,
    onDelete,
    onRename,
    confirmingDeleteId,
    collapsed = false,
    onToggleCollapse,
    mobileOpen,
}: ArtisticIntelligenceSidebarProps) {
    const [menu, setMenu] = React.useState<{
        id: string;
        top: number;
        left: number;
    } | null>(null);

    return (
        <aside
            data-mobile-open={mobileOpen || undefined}
            className={`${styles.sidebar}${collapsed ? ` ${styles.sidebarCollapsed}` : ""}`}
        >
            {/* Sidebar header: [logo] Artistic Intelligence [toggle].
                Owns the brand identity for the whole /artistic-intelligence surface so
                the main area's top bar can carry just the chat title +
                auth cluster. When collapsed the label hides and the
                brand mark doubles as the expand affordance (chevron
                fades in on hover via CSS). */}
            <div className={styles.sidebarHeader}>
                <div
                    className={`${styles.headerLogo} ${collapsed ? styles.headerLogoCollapsed : ""}`}
                    onClick={collapsed ? onToggleCollapse : undefined}
                    role={collapsed ? "button" : undefined}
                    tabIndex={collapsed ? 0 : undefined}
                >
                    {/* `xs` (32/36px) matches the global top-nav
                        clapperboard exactly, in both states. */}
                    <AppBrandMark href={collapsed ? undefined : "/studio"} size="xs" />
                    {!collapsed && (
                        <span className={`${styles.sidebarLabel} ${styles.headerSectionLabel}`}>
                            Artistic Intelligence
                        </span>
                    )}
                    {collapsed && (
                        <svg
                            className={styles.expandChevron}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                        >
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    )}
                </div>
                {onToggleCollapse && !collapsed && (
                    <button
                        type="button"
                        className={`${styles.sidebarHeaderCollapse} ${styles.sidebarLabel}`}
                        onClick={onToggleCollapse}
                        aria-label="Collapse sidebar"
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                        >
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                            <line x1="9" x2="9" y1="3" y2="21" />
                        </svg>
                    </button>
                )}
            </div>

            <div className={styles.sidebarNewChat}>
                <button
                    type="button"
                    className={styles.sidebarNewChatBtn}
                    onClick={onNewChat}
                >
                    <div className={styles.newChatIconWrap}>
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                        >
                            <path d="M12 5v14" />
                            <path d="M5 12h14" />
                        </svg>
                    </div>
                    <span className={styles.sidebarLabel}>New chat</span>
                </button>
            </div>

            <ModeNav
                mode={mode}
                onChange={onModeChange}
                unlockedModes={unlockedModes}
                onLockedClick={onLockedMode}
            />

            <div className={styles.sidebarSection}>
                <div className={styles.sectionHeader}>
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                    >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                    </svg>
                    <span className={styles.sidebarLabel}>
                        Chat history
                        {conversations.length > 0 && (
                            <span className={styles.sectionBadge}>
                                {conversations.length}
                            </span>
                        )}
                    </span>
                </div>
            </div>

            <div className={styles.sidebarList}>
                {conversations.length === 0 ? (
                    <p className={styles.sidebarEmpty}>
                        Your conversations will appear here.
                    </p>
                ) : (
                    conversations.map((c) => (
                        <SidebarRow
                            key={c.id}
                            conversation={c}
                            isActive={c.id === activeId}
                            isMenuOpen={menu?.id === c.id}
                            onSelect={() => onSelect(c.id)}
                            onOpenMenu={(top, left) => setMenu({ id: c.id, top, left })}
                        />
                    ))
                )}
            </div>

            {menu && (onDelete || onRename) && (
                <ConversationMenu
                    id={menu.id}
                    top={menu.top}
                    left={menu.left}
                    onClose={() => setMenu(null)}
                    confirmingDeleteId={confirmingDeleteId}
                    onRename={
                        onRename
                            ? () => {
                                  onRename(menu.id);
                                  setMenu(null);
                                }
                            : undefined
                    }
                    onDelete={onDelete}
                />
            )}
        </aside>
    );
}

function SidebarRow({
    conversation,
    isActive,
    isMenuOpen,
    onSelect,
    onOpenMenu,
}: {
    conversation: SidebarConversation;
    isActive: boolean;
    isMenuOpen: boolean;
    onSelect: () => void;
    onOpenMenu: (top: number, left: number) => void;
}) {
    const rowClasses = [
        styles.sidebarItem,
        isActive ? styles.sidebarItemActive : "",
    ]
        .filter(Boolean)
        .join(" ");

    const titleClasses = [
        styles.sidebarItemTitle,
        conversation.title === PLACEHOLDER_TITLE ? styles.titleShimmer : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={rowClasses}>
            <button
                type="button"
                className={styles.sidebarItemBody}
                onClick={onSelect}
                title={`${conversation.title} · ${formatTimeAgo(conversation.updatedAt)}${
                    conversation.isAnonymous ? " · Unsaved" : ""
                }`}
            >
                <span className={titleClasses}>{conversation.title}</span>
            </button>

            <button
                type="button"
                aria-label="More"
                className={`${styles.moreBtn} ${isMenuOpen ? styles.moreBtnOpen : ""}`}
                onClick={(e) => {
                    e.stopPropagation();
                    const rect = (
                        e.currentTarget as HTMLButtonElement
                    ).getBoundingClientRect();
                    onOpenMenu(rect.bottom + 4, rect.right - 160);
                }}
            >
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                >
                    <circle cx="5" cy="12" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="19" cy="12" r="1.6" />
                </svg>
            </button>
        </div>
    );
}

function ConversationMenu({
    id,
    top,
    left,
    onClose,
    confirmingDeleteId,
    onRename,
    onDelete,
}: {
    id: string;
    top: number;
    left: number;
    onClose: () => void;
    confirmingDeleteId?: string | null;
    onRename?: () => void;
    onDelete?: (id: string, confirmed?: boolean) => void;
}) {
    const isConfirming = confirmingDeleteId === id;

    return (
        <>
            <div
                className={styles.contextBackdrop}
                onClick={onClose}
                role="presentation"
            />
            <div
                className={`${styles.contextMenu} ui-menu`}
                style={{ top, left: Math.max(16, left) }}
                role="menu"
            >
                {onRename && (
                    <button
                        type="button"
                        role="menuitem"
                        className="ui-menu-item"
                        onClick={onRename}
                    >
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                        >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        Rename
                    </button>
                )}
                {onDelete && (
                    <button
                        type="button"
                        role="menuitem"
                        className={isConfirming ? "ui-menu-item ui-menu-item-danger" : "ui-menu-item"}
                        onClick={() => {
                            if (isConfirming) {
                                onClose();
                                onDelete(id, true);
                            } else {
                                onDelete(id, false);
                            }
                        }}
                    >
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                        >
                            <path d="M3 6h18" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        {isConfirming ? "Confirm delete?" : "Delete"}
                    </button>
                )}
            </div>
        </>
    );
}
