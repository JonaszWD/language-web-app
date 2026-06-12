import type { Metadata } from "next";
import "./globals.css";

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
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
