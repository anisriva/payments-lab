import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { LinkTabs } from "@/components/common/navigation/link-tabs";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Payments Lab",
  description: "POC for payments integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <header className="border-b">
            <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
              <span className="font-semibold">Payments Lab</span>
              <Badge variant="secondary">test mode</Badge>
            </div>
            <div className="mx-auto max-w-5xl px-4">
              <LinkTabs
                matchPrefix
                items={[
                  { href: '/platform', label: 'Platform' },
                  { href: '/byop', label: 'BYOP' },
                  { href: '/events', label: 'Events' },
                ]}
              />
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
