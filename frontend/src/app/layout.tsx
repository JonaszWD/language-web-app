import type { Metadata } from "next";
import { Archivo, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
});

const dmSerifDisplay = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SpanishUp — Learn Spanish with Spaced Repetition",
  description: "Master Spanish vocabulary with FSRS flashcards",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className="min-h-screen bg-gray-50 text-gray-900 antialiased"
        style={{
          ["--font-display" as string]: archivo.style.fontFamily,
          ["--font-body" as string]: archivo.style.fontFamily,
          ["--font-serif" as string]: dmSerifDisplay.style.fontFamily,
        }}
      >
        {children}
      </body>
    </html>
  );
}
