import type { Metadata, Viewport } from "next";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./globals.css";
export const viewport: Viewport = {
  themeColor: "#edf2f6",
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
};
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://knuckletat.com",
  ),
  title: "KNUCKLETAT",
  description: "aggregated open source intel.",
  applicationName: "KNUCKLETAT",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "KNUCKLETAT",
    title: "KNUCKLETAT",
    description: "aggregated open source intel.",
    images: [
      {
        url: "/knuckletat-og.png",
        width: 1200,
        height: 630,
        alt: "KNUCKLETAT — aggregated open source intel. A tattooed fist beside an illustrated globe.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KNUCKLETAT",
    description: "aggregated open source intel.",
    images: ["/knuckletat-og.png"],
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary name="Intelligence workspace">{children}</ErrorBoundary>
      </body>
    </html>
  );
}
