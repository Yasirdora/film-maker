import { createElement } from "react";

/**
 * Render a Script PDF and trigger a browser download.
 *
 * `@react-pdf/renderer` pulls in a WASM-backed yoga-layout chunk that must
 * stay out of the initial client bundle — both for size (~400KB+) and
 * because Turbopack can't resolve the chunk when it's reachable from the
 * initial render graph. Everything PDF-related is dynamically imported
 * here so it only loads when the user actually clicks an export button.
 */
export async function downloadPdf(params: {
    title: string;
    mode: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    fileName?: string;
}): Promise<void> {
    const [{ pdf }, { ScriptDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/pdf/ScriptDocument"),
    ]);

    const doc = createElement(ScriptDocument, {
        title: params.title,
        mode: params.mode,
        messages: params.messages,
    });

    const blob = await pdf(doc as any).toBlob();
    const url = URL.createObjectURL(blob);

    const safeName = (params.fileName ?? params.title)
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();

    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${safeName}.pdf`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 5000);
}
