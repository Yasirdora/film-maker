import type { Metadata, Viewport } from "next";
import { Google_Sans, Newsreader } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const googleSans = Google_Sans({
    subsets: ["latin"],
    variable: "--font-google-sans",
    display: "swap",
    adjustFontFallback: false,
});

const newsreader = Newsreader({
    subsets: ["latin"],
    style: ["italic"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-newsreader",
    display: "swap",
});

export const metadata: Metadata = {
    metadataBase: new URL("https://film-maker.net"),
    title: {
        default: "Film-maker — The Artistic Intelligence (AI) Studio",
        template: "%s · Film-maker Studio",
    },
    description:
        "AI-powered filmmaking. Generate cinematic images and videos with Google's latest models, in one simple tool.",
    openGraph: {
        title: "Film-maker — The Artistic Intelligence (AI) Studio",
        description: "AI-powered filmmaking, simplified.",
        url: "https://film-maker.net",
        siteName: "Film-maker",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Film-maker — The Artistic Intelligence (AI) Studio",
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
        <html lang="en" className={`${googleSans.variable} ${newsreader.variable}`} data-theme="dark">
            <body className="min-h-dvh">
                {children}
                <Toaster position="top-center" theme="dark" richColors closeButton />
            </body>
        </html>
    );
}
