import type { Metadata } from "next";
import ConverterView from "./ConverterView";
import { CONFIGS } from "./config";

export const metadata: Metadata = {
    title: "Media Converter",
    description:
        "Convert video, audio, and image files between modern formats — entirely in your browser.",
};

export default function ConverterPage() {
    return <ConverterView config={CONFIGS.universal} />;
}
