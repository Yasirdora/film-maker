import type { Metadata } from "next";
import ConverterView from "../ConverterView";
import { CONFIGS } from "../config";

export const metadata: Metadata = {
    title: "Image Converter — PNG, JPG, WEBP, HEIC, AVIF",
    description:
        "Convert images between PNG, JPG, WEBP, GIF, HEIC, AVIF, and more — fast, free, in your browser.",
};

export default function ImageConverterPage() {
    return <ConverterView config={CONFIGS.image} />;
}
