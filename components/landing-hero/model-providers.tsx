/**
 * ModelProviders — strip of supported model/provider names shown
 * underneath the hero. Signals the breadth of engines Film-maker
 * routes to (Nano Banana Pro today, others as v1 lands).
 *
 * Desktop: centered, wrapping row. Mobile: horizontally scrollable
 * so long lists never force awkward line breaks on narrow viewports.
 */

import type { SVGProps } from "react";

import styles from "./model-providers.module.css";

interface Provider {
    name: string;
    Icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
}

const PROVIDERS: readonly Provider[] = [
    { name: "Veo / Nano Banana", Icon: GoogleMark },
    { name: "Runway", Icon: RunwayMark },
    { name: "ElevenLabs", Icon: ElevenLabsMark },
    { name: "Kling", Icon: KlingMark },
    { name: "Seedream", Icon: SeedreamMark },
    { name: "Film-maker", Icon: FilmMakerMark },
    { name: "Flux", Icon: FluxMark },
    { name: "Ideogram", Icon: IdeogramMark },
];

export function ModelProviders() {
    // Duplicated list so the translateX(-50%) loop seams invisibly.
    const loop = [...PROVIDERS, ...PROVIDERS];

    return (
        <div className={styles.viewport}>
            <div className={styles.track}>
                {loop.map(({ name, Icon }, i) => (
                    <div
                        key={`${name}-${i}`}
                        className="flex shrink-0 items-center gap-2"
                        aria-hidden={i >= PROVIDERS.length ? "true" : undefined}
                    >
                        <Icon
                            aria-hidden="true"
                            className="size-4.5 shrink-0 text-white/70"
                        />
                        <span className="shrink-0 text-base font-normal text-white/70">
                            {name}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Marks ────────────────────────────────────────────────────────────────

function GoogleMark(props: SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="-30 -30 400 400" {...props}>
            <path d="M0 170C0 76.3 76.3 0 170 0c37.8 0 73.7 12.2 103.7 35.2l-39.5 51.3c-18.6-14.3-40.8-21.8-64.2-21.8-58.1 0-105.3 47.2-105.3 105.3S111.9 275.3 170 275.3c46.8 0 86.4-30.7 100.2-72.9H170v-64.7h170V170c0 93.7-76.3 170-170 170S0 263.7 0 170" />
        </svg>
    );
}

function RunwayMark(props: SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" {...props}>
            <path d="M20.678 14.063 17.99 11.38c5.666-.768 5.122-9.298-.61-9.298-2.358-.003-8.2.003-10.628 0-1.611-.018-3.192.878-4.011 2.266a4.7 4.7 0 0 0-.661 2.396c0 2.33.003 8.208 0 10.615-.005 5.726 8.526 6.262 9.31.616 1.55 1.437 3.572 4.27 5.99 4.05h-.002c4.038.123 6.254-5.183 3.3-7.96ZM8.594 17.36c.036 2.394-3.73 2.386-3.692 0V6.777A1.86 1.86 0 0 1 6.23 4.974c1.138-.367 2.396.577 2.364 1.768zM11.05 4.9h6.33c2.391-.039 2.394 3.723 0 3.684h-5.964c-.008-1.096.114-2.672-.366-3.684m5.027 13.764-.629-.632-4.029-4.022v-2.606h2.607l4.66 4.654c1.717 1.664-.944 4.323-2.61 2.606Z" />
        </svg>
    );
}

function ElevenLabsMark(props: SVGProps<SVGSVGElement>) {
    // Expanded viewBox pads the two bars so the mark visually matches
    // the rounder logos around it (those have native whitespace).
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="-4 -4 32 32" {...props}>
            <path d="M2 0h6v24H2zM16 0h6v24h-6z" />
        </svg>
    );
}

function KlingMark(props: SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" {...props}>
            <path d="M21.973 15.22a287 287 0 0 1-2.218-1.758c-.4-.32-.825-.659-1.347-1.073 3.47-4.107 1.171-7.015-.336-8.523-1.883-1.884-4.869-2.44-7.824-1.922-3.49.613-6.526 2.806-8.331 6.02l-.317.562s3.7 2.937 4.357 3.455c-3.27 4.432-1.227 7.086-.223 8.091 1.477 1.477 3.952 2.296 6.207 2.296.62 0 1.256-.054 1.894-.166 3.49-.613 6.527-2.807 8.333-6.02l.317-.563-.507-.398zM5.264 9.508a317 317 0 0 0-1.706-1.355c1.608-2.515 4.11-4.224 6.948-4.722 1.782-.312 3.51-.112 4.96.548-3.776.91-7.148 3.758-8.802 6.645L5.262 9.507zm4.096-.265c2.787-3.17 6.368-4.578 7.995-3.146s.69 5.163-2.099 8.333c-2.787 3.17-6.368 4.577-7.995 3.146-1.627-1.433-.69-5.164 2.099-8.333m4.213 11.476c-1.783.313-3.509.113-4.96-.547 3.776-.91 7.149-3.758 8.801-6.644.548.435.988.785 1.402 1.116.534.427 1.046.835 1.704 1.355-1.608 2.516-4.109 4.225-6.947 4.722z" />
        </svg>
    );
}

function SeedreamMark(props: SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 32 32" {...props}>
            <path d="M5.915 25.44 1 26.702V4.311l4.915 1.263zm23.75 1.31-4.924 1.264V3l4.924 1.254zm-15.952-.627-4.915 1.264v-13.19l4.915 1.263zm3.21-13.883 4.925-1.264v13.19l-4.924-1.264z" />
        </svg>
    );
}

function FilmMakerMark(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="870 420 75 60"
            overflow="visible"
            {...props}
        >
            <rect
                x="880.73"
                y="448.09"
                width="51.24"
                height="26.61"
                rx="1.02"
                ry="1.02"
            />
            <path
                style={{
                    transformOrigin: "882.45px 448.09px",
                    transform: "rotate(-15deg)",
                }}
                d="M882.45,448.09h47.91c.89,0,1.6-.72,1.6-1.6v-10.15c0-.89-.72-1.6-1.6-1.6h-47.17c-.84,0-1.54.65-1.6,1.49l-.74,10.15c-.07.93.67,1.72,1.6,1.72Z"
            />
        </svg>
    );
}

function FluxMark(props: SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 490 345" {...props}>
            <path d="M349.391 147.163h-52.114l-52.113-73.418L82.594 302.52h52.227l110.341-155.352h52.113L186.935 302.52h52.369l110.087-155.355v73.417l-58.013 81.949v42.597h-30.154l-.001.002h-52.114l.001-.002h-52.439l-.004.006h-52.113l.004-.006H0L245.164 0zM490 345.13h-52.114l-.001-.002h-30.156v-42.44l-58.338-82.106v-73.417z" />
        </svg>
    );
}

function IdeogramMark(props: SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 12 12" {...props}>
            <path d="M8.884.74a3.2 3.2 0 0 1 1.494 1.89 1.7 1.7 0 0 1 .627.398 1.7 1.7 0 0 1 .494 1.23 1.7 1.7 0 0 1-.546 1.207 1.69 1.69 0 0 1 .546 1.315 1.69 1.69 0 0 1-.654 1.264l-.018.015.01.016c.195.3.293.662.267 1.032l-.004.055a1.69 1.69 0 0 1-1.56 1.514 1.7 1.7 0 0 1-.77-.125 1.689 1.689 0 0 1-2.922.485 2 2 0 0 1-.818.199l-.062.004h-.449l-.034-.002c-.558-.033-.546-.887.034-.887h.402l.023-.002h.024a1.15 1.15 0 0 0 .039-2.3l-.04.002H1.404a.445.445 0 0 1 0-.89h3.517l.023-.001h.024a1.15 1.15 0 0 0 .254-2.273l-.07-.015a1 1 0 0 0-.15-.023l-.035.001H1.404a.445.445 0 1 1 0-.888h3.518l.023-.002h.023a1.15 1.15 0 1 0 .044-2.3l-.044.001h-.483c-.558-.034-.547-.888.034-.888h.4L4.968.77q.301.001.578.083l.015-.01A3.2 3.2 0 0 1 8.885.74M7.016 6.484l-.034.018-.042.025a2.04 2.04 0 0 1-.702 1.077 2.04 2.04 0 0 1 .769 1.594 2.03 2.03 0 0 1-.46 1.29.8.8 0 0 0 .97.233.8.8 0 0 0 .442-.894l-.015-.062-.007-.04-.002-.028-.001-.02v-.03l.003-.026.007-.04.009-.035.01-.032.018-.04.003-.005a.4.4 0 0 1 .079-.108l.027-.026.02-.016.026-.018.02-.013.028-.015.037-.015.028-.01.02-.005.039-.008.036-.005h.067l.029.003.028.005.031.008.016.005.024.008.027.012.022.01.027.016.017.011q.045.031.082.074l.019.023.017.024a.8.8 0 1 0 1.2-1.035 2 2 0 0 1-.237.003l-.028-.002-.013-.003h-.008A1.69 1.69 0 0 1 8.17 7.107l-.013-.058a.8.8 0 0 0-1.142-.566M4.808 8.78a.444.444 0 1 1 0 .889H2.97a.445.445 0 0 1 0-.889zM9.412 3.53a.8.8 0 0 0-.399.65l-.001.042a.445.445 0 0 1-.415.444h-.03a.445.445 0 0 1-.443-.414l-.001-.03a.8.8 0 0 0-1.264-.65 2.04 2.04 0 0 1-.627.837c.366.29.623.697.725 1.154A1.687 1.687 0 0 1 9.02 6.828l.01.046a.8.8 0 0 0 .697.63l.062.005.021.001q.045 0 .09-.005l.043-.005.03-.008a.8.8 0 0 0 .632-.844.8.8 0 0 0-.754-.737l-.04-.001a.44.44 0 0 1-.341-.16l-.017-.022a.44.44 0 0 1-.077-.351.445.445 0 0 1 .404-.355h.032a.8.8 0 0 0 .567-1.365.8.8 0 0 0-.393-.213l-.052-.01-.037-.007a.8.8 0 0 0-.486.102m-4.6 2.04a.445.445 0 1 1 0 .889H.445a.445.445 0 0 1 0-.889zm-.005-3.216a.444.444 0 1 1 0 .888H2.97a.445.445 0 1 1 0-.888zm1.649-.977-.027.01c.313.32.51.736.563 1.18a1.69 1.69 0 0 1 1.576.514 1.7 1.7 0 0 1 .847-.5 2.31 2.31 0 0 0-2.96-1.204" />
        </svg>
    );
}

