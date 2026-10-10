import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Newsreader, Schibsted_Grotesk } from "next/font/google";
import { MotionProvider } from "@/components/ui/MotionProvider";
import "./globals.css";

/*
 * Three voices, each with one job: Newsreader for words spoken in the room and Oriel's own
 * headlines, Schibsted Grotesk for the interface, IBM Plex Mono for time and measurement.
 */
// Self-hosted at build time (no request to a font service from visitors' browsers), Latin only,
// swap with metric-matched fallbacks. Only the headline's faces (serif roman and italic) are preloaded.
const serif = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-newsreader", display: "swap" });
const sans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted", display: "swap", preload: false });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: "Oriel: practice for the room before you're in it", template: "%s · Oriel" },
  description: "Mock interviews with an AI interviewer who listens, follows up and pushes back. Afterwards: your recording, the moments that mattered, and what to change.",
};

export const viewport: Viewport = { themeColor: "#151515", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh"><MotionProvider>{children}</MotionProvider></body>
    </html>
  );
}
