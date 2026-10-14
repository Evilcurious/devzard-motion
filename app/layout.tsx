import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Relay — Your personal AI workspace',
  description:
    'A little less busywork. Chat with your AI, connect your tools, and turn everyday tasks into done.',
  icons: { icon: '/icon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
