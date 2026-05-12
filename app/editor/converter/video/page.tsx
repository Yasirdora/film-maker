import type { Metadata } from "next";
import ConverterView from "../ConverterView";
import { CONFIGS } from "../config";

export const metadata: Metadata = {
    title: "Video Converter — MP4, MOV, WEBM, AVI, MKV",
    description:
        "Convert videos between MP4, MOV, WEBM, AVI, and MKV — right in your browser.",
};

export default function VideoConverterPage() {
    return <ConverterView config={CONFIGS.video} />;
}
