import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "mapbox-gl/dist/mapbox-gl.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  title: "Flight Pulse — U.S. Flight Operations Intelligence",
  description:
    "AI-powered intelligence on U.S. flight operations: what is happening today, what is unusual, and why it matters.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Flight Pulse — U.S. Flight Operations Intelligence",
    description:
      "AI-powered intelligence on U.S. flight operations: what is happening today, what is unusual, and why it matters.",
    type: "website",
    siteName: "Flight Pulse",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Flight Pulse — U.S. Flight Operations Intelligence",
    description:
      "AI-powered intelligence on U.S. flight operations: what is happening today, what is unusual, and why it matters.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen flex flex-col antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
