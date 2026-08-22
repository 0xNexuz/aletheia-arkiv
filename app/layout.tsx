import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "aletheia.pages.dev";
  const protocol = host.includes("localhost") ? "http" : "https";
  const image = `${protocol}://${host}/og.png`;
  const title = "Aletheia — Evidence, not verdicts";
  const description = "A creator-verifiable, self-expiring reserve evidence graph for DeFi risk teams.";
  return {
    title,
    description,
    icons: { icon: [{ url: "/favicon.png", type: "image/png", sizes: "64x64" }], shortcut: "/favicon.png", apple: "/logo-mark.png" },
    openGraph: { title, description, images: [{ url: image, width: 1672, height: 941, alt: "Aletheia — Evidence, not verdicts" }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

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
        {children}
      </body>
    </html>
  );
}
