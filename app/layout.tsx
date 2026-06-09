import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteTitle = "Kompari | AI Prediction Arena";
const siteDescription =
  "Kompariは、ChatGPT・Claude・Gemini・DeepSeek・My AIの予測を比較できるAI予測アリーナです。競馬、スポーツ、株価、暗号資産など、さまざまな予測をAIごとに比較できます。";

export const metadata: Metadata = {
  metadataBase: new URL("https://kompari.vercel.app"),
  title: {
    default: siteTitle,
    template: "%s | Kompari",
  },
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "https://kompari.vercel.app",
    siteName: "Kompari",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
