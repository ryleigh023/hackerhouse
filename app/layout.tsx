import type { Metadata, Viewport } from "next";
import { fontVars } from "@/lib/fonts";
import "./globals.css";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Framed in Goa — HH Goa 2026 Builder Pass",
  description:
    "Generate your Hacker House Goa 2026 builder ID card. Upload a photo, get a pass. Less noise, more signal. #FrameInGoa",
  openGraph: {
    title: "Framed in Goa — HH Goa 2026 Builder Pass",
    description: "Upload a photo. Get your HH Goa 2026 builder pass. #FrameInGoa",
    type: "website",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Framed in Goa — HH Goa 2026 Builder Pass",
    description: "Upload a photo. Get your HH Goa 2026 builder pass. #FrameInGoa",
    images: ["/api/og"],
  },
};

export const viewport: Viewport = {
  themeColor: "#04140B",
  width: "device-width",
  initialScale: 1,
  // deliberately NOT capping maximumScale: locking page zoom fails WCAG 1.4.4.
  // The card's own pinch-to-zoom stays unambiguous via `touch-action: none`
  // on the canvas, which claims those gestures without disabling page zoom.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVars}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
