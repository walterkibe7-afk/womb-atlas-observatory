import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";

// Design type families — all SELF-HOSTED from ./fonts/ (source: @fontsource
// packages). Self-hosting because fonts.gstatic.com is unreachable on some
// networks, and next/font/google requires live CDN access at compile time.
// Spectral (serif — headings & numerals) + Instrument Sans (body). Exposed as
// CSS vars and mapped to --font-serif / --font-sans in globals.
const spectral = localFont({
  src: [
    { path: "./fonts/spectral-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/spectral-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/spectral-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/spectral-latin-500-italic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/spectral-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/spectral-latin-600-italic.woff2", weight: "600", style: "italic" },
    { path: "./fonts/spectral-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/spectral-latin-700-italic.woff2", weight: "700", style: "italic" },
  ],
  variable: "--font-spectral",
});
const instrumentSans = localFont({
  src: "./fonts/instrument-sans-latin-wght-normal.woff2", // variable: covers 400–700
  weight: "400 700",
  variable: "--font-instrument",
});

// Participant-portal type system (mobile-app parity): Fraunces for screen
// titles/headings, Manrope for body/helper text, JetBrains Mono for meta /
// progress labels. Loaded globally but only wired to --font-serif/-sans/-mono
// inside `.theme-participant` (globals.css) — every other portal keeps
// Spectral/Instrument/Geist Mono above.
const fraunces = localFont({
  src: [
    { path: "./fonts/fraunces-latin-wght-normal.woff2", weight: "300 600", style: "normal" }, // variable
    { path: "./fonts/fraunces-latin-wght-italic.woff2", weight: "300 600", style: "italic" }, // variable
  ],
  variable: "--font-fraunces",
});
const manrope = localFont({
  src: "./fonts/manrope-latin-wght-normal.woff2", // variable: covers 400–700
  weight: "400 700",
  variable: "--font-manrope",
});
const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin-wght-normal.woff2", // variable: covers 100–800
  weight: "400 500",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Womb Atlas Observatory",
  description: "A secure observatory for tracking uterine health and experiences.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spectral.variable} ${instrumentSans.variable} ${fraunces.variable} ${manrope.variable} ${jetbrainsMono.variable} font-sans bg-[var(--color-background)] text-[var(--color-text-primary)] min-h-screen`}>
        <SessionProviderWrapper>
          {children}
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
