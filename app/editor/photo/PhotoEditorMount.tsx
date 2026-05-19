"use client";

/**
 * PhotoEditorMount — composition root for the /editor/photo route.
 *
 * Mirrors the Video / Audio editor mounts:
 *
 *   1. Hoisted dynamic import so the chunk download is shared with the
 *      boot-loader effect (no duplicate network work).
 *   2. `useBootLoader` drives the clapperboard fade-out once the chunk
 *      resolves, so the photo editor feels like a peer of the other
 *      editors rather than a different surface.
 *   3. Image state lives at this level so the editor body (drop zone
 *      / canvas), the PageBar's Export button, and the export dialog
 *      all see the same `LoadedImage`. Swapping the image
 *      automatically releases the previous bitmap + blob URL via
 *      `revokeLoadedImage`.
 *   4. Export runs inside `<PhotoExportDialog>` (filename / format /
 *      quality slider, identical shape to the video and audio
 *      dialogs). The button in the PageBar just toggles the dialog
 *      open. Decode errors still surface via a `sonner` toast since
 *      they originate here before the dialog exists.
 *
 * Layout matches the video editor: PageBar pinned to the top, the
 * editor body sized to `100dvh - topOffset` so its content can scroll
 * internally without pushing the page past the viewport.
 */

import dynamic from "next/dynamic";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { toast } from "sonner";

import PageBar from "@/components/editor/PageBar";
import PageKebabMenu from "@/components/editor/shared/PageKebabMenu";
import { ClapperboardLoader } from "@/components/landing-hero/clapperboard-loader";
import { useBootLoader } from "@/lib/editor/useBootLoader";
import PhotoExportDialog from "@/components/editor/photo/PhotoExportDialog";
import {
    revokeLoadedImage,
    decodeImage,
    isSupportedImageFile,
    type LoadedImage,
} from "@/lib/editor/photo";

import {
    PhotoExportButton,
    PhotoFileOpenButton,
} from "./PhotoEditorPageActions";

/* Hoisted so both the `dynamic()` proxy and the boot-loader effect
   share the same import promise. `import()` is module-cached, so the
   second call resolves with the already-loaded chunk. */
const importPhotoEditor = () =>
    import("@/components/editor/photo/PhotoEditor");

const PhotoEditor = dynamic(importPhotoEditor, {
    ssr: false,
    /* Render nothing in the dynamic slot — the boot-loader overlay below
       covers the viewport while the chunk loads, then fades out via the
       clap animation when the chunk resolves. */
    loading: () => null,
});

export default function PhotoEditorMount() {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const [topOffset, setTopOffset] = useState(0);

    /* ── Boot loader ────────────────────────────────────────────── */

    const [chunkReady, setChunkReady] = useState(false);
    useEffect(() => {
        let cancelled = false;
        importPhotoEditor().then(() => {
            if (!cancelled) setChunkReady(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const loaderPhase = useBootLoader(chunkReady);

    /* ── Layout measure ─────────────────────────────────────────── */

    useLayoutEffect(() => {
        const measure = () => {
            const el = editorRef.current;
            if (el) setTopOffset(el.getBoundingClientRect().top);
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, []);

    /* ── Image state ────────────────────────────────────────────── */

    const [image, setImageState] = useState<LoadedImage | null>(null);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);

    /* Always swap through this setter so the previous bitmap and blob
       URL are released — leaking either is invisible until many opens
       in, when memory pressure starts pushing other tabs out. */
    const setImage = useCallback((next: LoadedImage | null) => {
        setImageState((prev) => {
            if (prev && prev !== next) revokeLoadedImage(prev);
            return next;
        });
    }, []);

    /* On unmount: release whatever bitmap is still live. */
    useEffect(() => {
        return () => {
            setImageState((prev) => {
                if (prev) revokeLoadedImage(prev);
                return null;
            });
        };
    }, []);

    const handleFile = useCallback(
        async (file: File) => {
            if (!isSupportedImageFile(file)) {
                toast.error(
                    `Can't open "${file.name}" — try a PNG, JPEG, WebP, GIF, AVIF, or BMP file.`,
                );
                return;
            }
            try {
                const next = await decodeImage(file);
                setImage(next);
            } catch (err) {
                console.error("PhotoEditorMount: decode failed", err);
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Couldn't decode that image.",
                );
            }
        },
        [setImage],
    );

    /* ── Export dialog ──────────────────────────────────────────── */

    const openExportDialog = useCallback(() => {
        if (!image) return;
        setExportDialogOpen(true);
    }, [image]);

    const closeExportDialog = useCallback(() => {
        setExportDialogOpen(false);
    }, []);

    /* ── Render ─────────────────────────────────────────────────── */

    return (
        <div className="contents no-focus-ring">
            <PageBar
                breadcrumbs={[
                    { label: "Home", href: "/editor" },
                    { label: "Photo Editor" },
                ]}
                badge="ALPHA"
                pageMenu={
                    <PageKebabMenu label="Photo editor menu">
                        {/* Tool-specific items will land here as they
                            ship (clear image, recent files, etc.). The
                            slot is wired now so the visual is in place
                            and the disabled placeholder gives users a
                            preview of where actions will live. */}
                        <button type="button" className="ui-menu-item" disabled aria-disabled>
                            <span className="text-white/50">Tool actions coming soon</span>
                        </button>
                    </PageKebabMenu>
                }
                leadingActions={
                    <PhotoFileOpenButton
                        hasImage={!!image}
                        onFile={handleFile}
                    />
                }
                actions={
                    <>
                        {image && (
                            <>
                                <span
                                    className="self-center text-[12px] tabular-nums text-white/55"
                                    title={`${image.width} × ${image.height} pixels`}
                                >
                                    {image.width}×{image.height}
                                </span>
                                <span
                                    aria-hidden
                                    className="self-center w-px h-4 mx-1.5"
                                    style={{
                                        backgroundColor:
                                            "rgba(255, 255, 255, 0.10)",
                                    }}
                                />
                            </>
                        )}
                        <PhotoExportButton
                            hasImage={!!image}
                            onClick={openExportDialog}
                        />
                    </>
                }
            />
            <div
                ref={editorRef}
                style={{
                    height: `calc(100dvh - ${topOffset}px)`,
                    overflow: "hidden",
                }}
            >
                <PhotoEditor image={image} onFile={handleFile} />
            </div>
            {/* Kept mounted through every phase — including `finished` — so
                the CSS opacity transition has a node to animate against. */}
            <ClapperboardLoader phase={loaderPhase} />

            <PhotoExportDialog
                open={exportDialogOpen}
                onClose={closeExportDialog}
                image={image}
            />
        </div>
    );
}
