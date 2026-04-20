/**
 * Auteur message bubble — the visible row per message.
 *
 * Faithfully preserves the ConveX styling cues:
 *   • User bubbles: gray card with a 6px bottom-right corner (tail).
 *   • Assistant bubbles: transparent (text only), 6px bottom-left corner.
 *   • Streaming: yellow `#eab308` 6×16 caret blinking at `steps(2)` 0.8s.
 *   • Pending: the same caret as a standalone element.
 *   • Message entrance: 8px-rise fade, `messageIn 0.3s ease-out both`.
 *
 * Rendering of assistant prose handles three markdown-ish things users
 * see the most — fenced code blocks, inline backticks, paragraph breaks.
 * Anything heavier (tables, headings) renders as plain text for now.
 */

"use client";

import * as React from "react";
import Image from "next/image";
import type { MessageStatus } from "@/lib/auteur";
import styles from "./auteur.module.css";

export interface MessageBubbleProps {
    id: string;
    role: "user" | "assistant";
    content: string;
    status: MessageStatus;
    imageUrls: string[];
    isStreaming: boolean;
}

export function MessageBubble({
    role,
    content,
    status,
    imageUrls,
    isStreaming,
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
                    <span className={styles.pendingCursor} aria-label="Auteur is thinking" />
                ) : isUser ? (
                    <span>{content}</span>
                ) : (
                    <AssistantMarkdown text={content} />
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

function AssistantMarkdown({ text }: { text: string }) {
    const segments = React.useMemo(() => splitOnFences(text), [text]);
    return (
        <div className={styles.markdown}>
            {segments.map((seg, idx) =>
                seg.kind === "code" ? (
                    <CodeBlock
                        key={idx}
                        language={seg.language}
                        code={seg.value}
                    />
                ) : (
                    <ParagraphText key={idx} text={seg.value} />
                ),
            )}
        </div>
    );
}

function ParagraphText({ text }: { text: string }) {
    const paragraphs = text.split(/\n{2,}/).filter((p) => p.length > 0);
    if (paragraphs.length === 0) return null;
    return (
        <>
            {paragraphs.map((p, i) => (
                <p key={i} style={{ whiteSpace: "pre-wrap" }}>
                    {renderInlineCode(p)}
                </p>
            ))}
        </>
    );
}

function renderInlineCode(input: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    const regex = /`([^`\n]+)`/g;
    let last = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = regex.exec(input)) !== null) {
        if (match.index > last) nodes.push(input.slice(last, match.index));
        nodes.push(
            <code key={key++} className={styles.inlineCode}>
                {match[1]}
            </code>,
        );
        last = match.index + match[0].length;
    }
    if (last < input.length) nodes.push(input.slice(last));
    return nodes;
}

function splitOnFences(text: string): Array<
    | { kind: "text"; value: string }
    | { kind: "code"; language: string; value: string }
> {
    const segments: Array<
        | { kind: "text"; value: string }
        | { kind: "code"; language: string; value: string }
    > = [];
    const regex = /```(\w+)?\n?([\s\S]*?)```/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > last) {
            segments.push({ kind: "text", value: text.slice(last, match.index) });
        }
        segments.push({
            kind: "code",
            language: match[1] ?? "",
            value: match[2].trimEnd(),
        });
        last = match.index + match[0].length;
    }
    if (last < text.length) {
        segments.push({ kind: "text", value: text.slice(last) });
    }
    return segments;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
    const [copied, setCopied] = React.useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard may be denied in non-secure contexts — silent no-op.
        }
    };
    return (
        <div className={styles.codeBlockWrap}>
            <pre>
                <code>{code}</code>
            </pre>
            <div className={styles.codeBlockToolbar}>
                <button
                    type="button"
                    onClick={copy}
                    className={styles.codeBlockBtn}
                    aria-label={`Copy ${language || "code"}`}
                >
                    {copied ? "Copied" : "Copy"}
                </button>
            </div>
        </div>
    );
}
