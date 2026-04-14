import type { Metadata, Viewport } from "next";
import { Google_Sans } from "next/font/google";
import "./globals.css";

const googleSans = Google_Sans({
    subsets: ["latin"],
    variable: "--font-google-sans",
});

export const metadata: Metadata = {
    metadataBase: new URL("https://film-maker.net"),
    title: {
        default: "Film-maker — AI filmmaking, simplified",
        template: "%s · Film-maker",
    },
    description:
        "AI-powered filmmaking. Generate cinematic images and videos with Google's latest models, in one simple tool.",
    openGraph: {
        title: "Film-maker",
        description: "AI-powered filmmaking, simplified.",
        url: "https://film-maker.net",
        siteName: "Film-maker",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Film-maker",
        description: "AI-powered filmmaking, simplified.",
    },
    robots: {
        index: true,
        follow: true,
    },
};

// Mobile-first viewport configuration.
// - initial-scale=1 with no maximum-scale so users can pinch-zoom (accessibility).
// - viewport-fit=cover so we can use safe-area insets on notched devices.
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#ffffff" },
        { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    ],
};

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={googleSans.variable}>
            <body className="min-h-dvh">{children}</body>
        </html>
    );
}
