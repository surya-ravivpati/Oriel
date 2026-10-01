import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-instrument-serif" });
const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "Oriel — Practice for the room before you're in it", template: "%s · Oriel" },
  description: "Oriel simulates realistic interviews, adapts pressure to your performance, and shows you exactly what happened in your own recording.",
};

export const viewport: Viewport = { themeColor: "#07070b", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="grain min-h-dvh">{children}</body>
    </html>
  );
}
