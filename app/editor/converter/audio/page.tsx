import type { Metadata } from "next";
import ConverterView from "../ConverterView";
import { CONFIGS } from "../config";

export const metadata: Metadata = {
    title: "Audio Converter — MP3, WAV, FLAC, AAC, OGG",
    description:
        "Convert audio between MP3, WAV, FLAC, AAC, OGG, and M4A — free, in your browser.",
};

export default function AudioConverterPage() {
    return <ConverterView config={CONFIGS.audio} />;
}
