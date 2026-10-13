import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Devzard Motion — AI automation platform",
  description:
    "AI chatbot, Gmail auto-reply, Google Sheets budget & profit tracking, and WhatsApp + Instagram support automation. Runs on Vercel or locally, with cloud or self-hosted models.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
