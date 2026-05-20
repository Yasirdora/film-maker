import {
    Document,
    Page,
    View,
    Text,
    Link,
    StyleSheet,
} from "@react-pdf/renderer";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface ScriptMessage {
    role: "user" | "assistant";
    content: string;
}

interface ScriptDocumentProps {
    title: string;
    mode: string;
    messages: ScriptMessage[];
}

/* ── Styles ────────────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
    page: {
        paddingTop: 60,
        paddingBottom: 60,
        paddingHorizontal: 72,
        backgroundColor: "#ffffff",
        fontFamily: "Courier",
    },
    header: {
        marginBottom: 30,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#e0e0e0",
    },
    title: {
        fontSize: 18,
        fontWeight: 700,
        color: "#111111",
        textTransform: "uppercase",
        letterSpacing: 1.5,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 10,
        color: "#888888",
    },
    block: {
        marginBottom: 16,
    },
    userLabel: {
        fontSize: 10,
        fontWeight: 700,
        color: "#111111",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 4,
    },
    assistantLabel: {
        fontSize: 10,
        fontWeight: 700,
        color: "#555555",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 4,
    },
    userText: {
        fontSize: 11,
        color: "#111111",
        lineHeight: 1.6,
    },
    assistantText: {
        fontSize: 11,
        color: "#333333",
        lineHeight: 1.6,
    },
    separator: {
        borderBottomWidth: 0.5,
        borderBottomColor: "#e8e8e8",
        marginVertical: 12,
    },
    footer: {
        position: "absolute",
        bottom: 24,
        left: 40,
        right: 40,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    footerLeft: {
        fontSize: 9,
        color: "#999999",
        textDecoration: "none",
    },
    footerRight: {
        fontSize: 8,
        color: "#bbbbbb",
    },
    shotListPage: {
        paddingTop: 48,
        paddingBottom: 48,
        paddingHorizontal: 40,
        backgroundColor: "#ffffff",
        fontFamily: "Courier",
    },
    table: {
        marginTop: 8,
        borderWidth: 0.75,
        borderColor: "#cccccc",
    },
    tableRow: {
        flexDirection: "row",
        borderBottomWidth: 0.5,
        borderBottomColor: "#dddddd",
        minHeight: 28,
    },
    tableRowAlt: {
        flexDirection: "row",
        borderBottomWidth: 0.5,
        borderBottomColor: "#dddddd",
        backgroundColor: "#fafafa",
        minHeight: 28,
    },
    tableHeaderRow: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#222222",
        backgroundColor: "#1a1a1a",
        minHeight: 24,
    },
    tableCell: {
        fontSize: 8.5,
        fontFamily: "Courier",
        color: "#333333",
        paddingVertical: 6,
        paddingHorizontal: 8,
        lineHeight: 1.5,
    },
    tableCellHeader: {
        fontSize: 7.5,
        fontWeight: 700,
        color: "#ffffff",
        paddingVertical: 6,
        paddingHorizontal: 8,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    tableCellNum: {
        fontSize: 8.5,
        fontWeight: 700,
        color: "#111111",
        paddingVertical: 6,
        paddingHorizontal: 8,
        textAlign: "center",
    },
});

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function stripMarkdown(text: string): string {
    return text
        .replace(/#{1,6}\s+/g, "") // headings
        .replace(/\*\*(.+?)\*\*/g, "$1") // bold
        .replace(/\*(.+?)\*/g, "$1") // italic
        .replace(/__(.+?)__/g, "$1") // bold alt
        .replace(/_(.+?)_/g, "$1") // italic alt
        .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, "")) // code
        .replace(/^\s*[-*+]\s+/gm, "- ") // list items
        .replace(/^\s*\d+\.\s+/gm, "") // numbered lists
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
        .trim();
}

function parseTable(text: string): string[][] | null {
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return null;
    if (!lines.every((l) => l.includes("|"))) return null;
    return lines.map((line) => line.split("|").map((c) => c.trim()));
}

function computeColumnWidths(headers: string[]): string[] {
    const TINY = ["#", "no", "no."];
    const NARROW = ["lens"];
    const SMALL = ["movement", "angle", "size", "shot size"];

    const weights = headers.map((h) => {
        const lower = h.toLowerCase();
        if (TINY.includes(lower)) return 0.5;
        if (NARROW.includes(lower)) return 1;
        if (SMALL.includes(lower)) return 2;
        return 5;
    });

    const total = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => `${Math.max((w / total) * 100, 3)}%`);
}

const MODE_LABELS: Record<string, string> = {
    chat: "Chat",
    script: "Script",
    shot_list: "Shot List",
    storyboard: "Storyboard",
};

/* ── Component ─────────────────────────────────────────────────────────────── */

export function ScriptDocument({ title, mode, messages }: ScriptDocumentProps) {
    const modeLabel = MODE_LABELS[mode] ?? mode;

    return (
        <Document title={title} author="Film-maker">
            <Page
                size="LETTER"
                orientation={mode === "shot_list" ? "landscape" : "portrait"}
                style={mode === "shot_list" ? s.shotListPage : s.page}
                wrap
            >
                {/* Header — only on first page */}
                <View style={s.header} fixed={false}>
                    <Text style={s.title}>{title}</Text>
                    <Text style={s.subtitle}>
                        Artistic Intelligence {modeLabel} &mdash;{" "}
                        {new Date().toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </Text>
                </View>

                {/* Messages */}
                {messages.map((msg, i) => {
                    const table = parseTable(msg.content);
                    return (
                        <View key={i} style={s.block}>
                            <Text
                                style={
                                    msg.role === "user"
                                        ? s.userLabel
                                        : s.assistantLabel
                                }
                                minPresenceAhead={40}
                            >
                                {msg.role === "user" ? "YOU" : "ARTISTIC INTELLIGENCE"}
                            </Text>
                            {table ? (
                                <View style={s.table}>
                                    {table.map((row, ri) => {
                                        const isHeader = ri === 0;
                                        const colWidths = isHeader
                                            ? computeColumnWidths(row)
                                            : computeColumnWidths(table[0]);
                                        const isAlt = !isHeader && ri % 2 === 0;
                                        return (
                                            <View
                                                key={ri}
                                                style={
                                                    isHeader
                                                        ? s.tableHeaderRow
                                                        : isAlt
                                                          ? s.tableRowAlt
                                                          : s.tableRow
                                                }
                                                wrap={false}
                                            >
                                                {row.map((cell, ci) => {
                                                    const isNumCol =
                                                        ci === 0 && !isHeader;
                                                    return (
                                                        <Text
                                                            key={ci}
                                                            style={[
                                                                isHeader
                                                                    ? s.tableCellHeader
                                                                    : isNumCol
                                                                      ? s.tableCellNum
                                                                      : s.tableCell,
                                                                {
                                                                    width: colWidths[
                                                                        ci
                                                                    ],
                                                                },
                                                            ]}
                                                        >
                                                            {cell}
                                                        </Text>
                                                    );
                                                })}
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : (
                                <Text
                                    style={
                                        msg.role === "user"
                                            ? s.userText
                                            : s.assistantText
                                    }
                                >
                                    {stripMarkdown(msg.content)}
                                </Text>
                            )}
                            {i < messages.length - 1 && (
                                <View style={s.separator} />
                            )}
                        </View>
                    );
                })}

                {/* Footer */}
                <View style={s.footer} fixed>
                    <Link src="https://film-maker.net" style={s.footerLeft}>
                        Film-maker.net
                    </Link>
                    <Text
                        style={s.footerRight}
                        render={({ pageNumber, totalPages }) =>
                            `${pageNumber} / ${totalPages}`
                        }
                    />
                </View>
            </Page>
        </Document>
    );
}
