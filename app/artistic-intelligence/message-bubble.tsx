"use client";

import * as React from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MessageStatus } from "@/lib/artistic-intelligence";
import { downloadPdf } from "@/lib/pdf";
import styles from "./artistic-intelligence.module.css";

export interface MessageBubbleProps {
    id: string;
    role: "user" | "assistant";
    content: string;
    status: MessageStatus;
    imageUrls: string[];
    isStreaming: boolean;
    conversationTitle?: string;
}

export function MessageBubble({
    role,
    content,
    status,
    imageUrls,
    isStreaming,
    conversationTitle = "Conversation",
}: MessageBubbleProps) {
    const isUser = role === "user";
    const isPending = status === "pending" && content.length === 0;
    const showCaret = isStreaming && content.length > 0;

    return (
        <div
            className={`${styles.message} ${isUser ? styles.messageUser : ""}`}
        >
            <div
                className={[
                    styles.bubble,
                    isUser ? styles.bubbleUser : styles.bubbleAssistant,
                    showCaret ? styles.streaming : "",
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                {imageUrls.length > 0 && (
                    <div className={styles.messageImages}>
                        {imageUrls.map((url, i) => (
                            <Image
                                key={`${url}-${i}`}
                                src={url}
                                alt="Attachment"
                                width={200}
                                height={200}
                                className={styles.messageImage}
                                unoptimized
                            />
                        ))}
                    </div>
                )}

                {isPending ? (
                    <span className={styles.pendingCursor} aria-label="Artistic Intelligence is thinking" />
                ) : isUser ? (
                    <span className={styles.userContent}>{content}</span>
                ) : (
                    <div className={styles.markdown}>
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                pre: ({ children }) => {
                                    const codeNode = React.Children.toArray(children)[0];
                                    if (React.isValidElement<{ children?: React.ReactNode }>(codeNode) && codeNode.props.children) {
                                        return (
                                            <CodeBlock
                                                code={String(codeNode.props.children).trim()}
                                                conversationTitle={conversationTitle}
                                            />
                                        );
                                    }
                                    return <pre>{children}</pre>;
                                },
                                table: ({ children }) => (
                                    <ShotListTable
                                        content={renderChildrenToString(children)}
                                        conversationTitle={conversationTitle}
                                    >
                                        <table>{children}</table>
                                    </ShotListTable>
                                ),
                            }}
                        >
                            {content}
                        </ReactMarkdown>
                    </div>
                )}

                {status === "stopped" && (
                    <span className={styles.bubbleStatus}>Stopped</span>
                )}
                {status === "failed" && (
                    <span
                        className={`${styles.bubbleStatus} ${styles.bubbleStatusError}`}
                    >
                        Reply failed — please try again.
                    </span>
                )}
            </div>
        </div>
    );
}

/**
 * Robustly convert React children back to a markdown-ish string for table parsing.
 */
function renderChildrenToString(children: React.ReactNode): string {
    let text = "";
    React.Children.forEach(children, (child) => {
        if (typeof child === "string" || typeof child === "number") {
            text += String(child);
        } else if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
            text += renderChildrenToString(child.props.children);
            if (child.type === "tr") text += "\n";
            if (child.type === "td" || child.type === "th") text += " | ";
        }
    });
    return text;
}

function CodeBlock({ code, conversationTitle }: { code: string; conversationTitle: string }) {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {}
    };

    const handleExport = async () => {
        await downloadPdf({
            title: conversationTitle,
            mode: "script",
            messages: [
                { role: "assistant", content: `\`\`\`\n${code}\n\`\`\`` },
            ],
            fileName: `${conversationTitle}_script`,
        });
    };

    return (
        <div className={styles.codeBlockWrap}>
            <pre>
                <code>{code}</code>
            </pre>
            <div className={styles.blockToolbar}>
                <button type="button" className={styles.toolbarBtn} onClick={handleCopy}>
                    {copied ? "Copied" : "Copy"}
                </button>
                <button type="button" className={styles.toolbarBtn} onClick={handleExport}>
                    PDF
                </button>
            </div>
        </div>
    );
}

function ShotListTable({
    children,
    content,
    conversationTitle,
}: {
    children: React.ReactNode;
    content: string;
    conversationTitle: string;
}) {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {}
    };

    const handleExport = async () => {
        await downloadPdf({
            title: conversationTitle,
            mode: "shot_list",
            messages: [{ role: "assistant", content }],
            fileName: `${conversationTitle}_shot_list`,
        });
    };

    return (
        <div className={styles.tableWrap}>
            <div className={styles.tableScroll}>{children}</div>
            <div className={styles.blockToolbar}>
                <button type="button" className={styles.toolbarBtn} onClick={handleCopy}>
                    {copied ? "Copied" : "Copy"}
                </button>
                <button type="button" className={styles.toolbarBtn} onClick={handleExport}>
                    PDF
                </button>
            </div>
        </div>
    );
}

