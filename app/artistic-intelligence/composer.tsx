/**
 * Composer shell — the unified input card at the bottom of the chat.
 *
 * Preserves the ConveX visual signature: 16 px rounded shell that
 * highlights in the brand orange on focus-within, a plain inline
 * textarea, a 34 px attach glyph, and a 36 px orange send button that
 * swaps to gray "Stop" while a reply is streaming.
 *
 * Keyboard model:
 *   • Enter         → send
 *   • Shift+Enter   → newline
 *   • Esc (stream)  → stop
 */

"use client";

import * as React from "react";
import Image from "next/image";
import { MAX_IMAGE_ATTACHMENTS_PER_MESSAGE } from "@/lib/artistic-intelligence";
import styles from "./artistic-intelligence.module.css";

export interface Attachment {
    id: string;
    /** Base64 payload sent to the server. */
    data: string;
    mimeType: string;
    /** Data URL for the local preview only — never uploaded. */
    previewUrl: string;
    filename: string;
}

interface ArtisticIntelligenceComposerProps {
    disabled?: boolean;
    isStreaming: boolean;
    placeholder: string;
    onSend: (params: { content: string; attachments: Attachment[] }) => void;
    onStop: () => void;
    hint?: React.ReactNode;
    hintAction?: { label: string; href: string };
}

/** Keep in sync with MAX_IMAGE_BASE64_LENGTH in the messages route. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"];

export function ArtisticIntelligenceComposer({
    disabled,
    isStreaming,
    placeholder,
    onSend,
    onStop,
    hint,
    hintAction,
}: ArtisticIntelligenceComposerProps) {
    const [value, setValue] = React.useState("");
    const [attachments, setAttachments] = React.useState<Attachment[]>([]);
    const [error, setError] = React.useState<string | null>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    const canSend =
        !disabled &&
        !isStreaming &&
        (value.trim().length > 0 || attachments.length > 0);

    React.useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [value, attachments.length]);

    const submit = () => {
        if (!canSend) return;
        onSend({ content: value.trim(), attachments });
        setValue("");
        setAttachments([]);
        setError(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
        }
        if (e.key === "Escape" && isStreaming) {
            e.preventDefault();
            onStop();
        }
    };

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const room = MAX_IMAGE_ATTACHMENTS_PER_MESSAGE - attachments.length;
        if (room <= 0) {
            setError(
                `Up to ${MAX_IMAGE_ATTACHMENTS_PER_MESSAGE} images per message.`,
            );
            return;
        }
        const picks = Array.from(files).slice(0, room);
        const accepted: Attachment[] = [];
        for (const file of picks) {
            if (!ACCEPTED_MIME.includes(file.type)) {
                setError("Only JPEG, PNG, or WebP images are allowed.");
                continue;
            }
            if (file.size > MAX_IMAGE_BYTES) {
                setError("Each image must be 10 MB or smaller.");
                continue;
            }
            try {
                const { data, previewUrl } = await readFile(file);
                accepted.push({
                    id: `${file.name}-${file.lastModified}-${accepted.length}`,
                    data,
                    mimeType: file.type,
                    previewUrl,
                    filename: file.name,
                });
            } catch {
                setError("Couldn't read that file.");
            }
        }
        if (accepted.length > 0) {
            setAttachments((prev) => [...prev, ...accepted]);
            setError(null);
        }
    };

    const removeAttachment = (id: string) => {
        setAttachments((prev) => prev.filter((a) => a.id !== id));
    };

    return (
        <div>
            <div className={styles.composerShell}>
                {attachments.length > 0 && (
                    <div
                        className={styles.imagePreviewRow}
                        aria-label="Attached images"
                    >
                        {attachments.map((a) => (
                            <div
                                key={a.id}
                                className={styles.imagePreviewThumb}
                            >
                                <Image
                                    src={a.previewUrl}
                                    alt={a.filename}
                                    fill
                                    sizes="56px"
                                    className={styles.imagePreviewImg}
                                    unoptimized
                                />
                                <button
                                    type="button"
                                    onClick={() => removeAttachment(a.id)}
                                    aria-label={`Remove ${a.filename}`}
                                    className={styles.imagePreviewRemove}
                                >
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden
                                    >
                                        <path d="M18 6 6 18" />
                                        <path d="m6 6 12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className={styles.inputWrapper}>
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className={styles.textarea}
                        disabled={disabled}
                    />

                    <div className={styles.inputActions}>
                        <button
                            type="button"
                            aria-label="Attach image"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={
                                disabled ||
                                attachments.length >=
                                    MAX_IMAGE_ATTACHMENTS_PER_MESSAGE
                            }
                            className={styles.attachBtn}
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
                                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                            </svg>
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={ACCEPTED_MIME.join(",")}
                            multiple
                            hidden
                            onChange={(e) => {
                                void handleFiles(e.target.files);
                                e.target.value = "";
                            }}
                        />

                        {isStreaming ? (
                            <button
                                type="button"
                                onClick={onStop}
                                aria-label="Stop generation"
                                className={`${styles.sendBtn} ${styles.stopBtn}`}
                            >
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    aria-hidden
                                >
                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                </svg>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={submit}
                                disabled={!canSend}
                                aria-label="Send message"
                                className={styles.sendBtn}
                            >
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
                                    <path d="m5 12 7-7 7 7" />
                                    <path d="M12 5v14" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <p role="alert" className={styles.composerError}>
                        {error}
                    </p>
                )}
            </div>

            {hint && (
                <div className={styles.composerHint}>
                    <span>{hint}</span>
                    {hintAction && <a href={hintAction.href}>{hintAction.label}</a>}
                </div>
            )}
        </div>
    );
}

function readFile(file: File): Promise<{ data: string; previewUrl: string }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== "string") {
                reject(new Error("Unexpected FileReader result"));
                return;
            }
            const commaIdx = result.indexOf(",");
            const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
            resolve({ data: base64, previewUrl: result });
        };
        reader.readAsDataURL(file);
    });
}
