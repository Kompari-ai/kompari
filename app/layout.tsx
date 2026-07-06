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
  "Kompariは、ChatGPT・Claude・Gemini・DeepSeek・Grokによる競馬予測を比較し、結果と的中率まで確認できるAI予測メディアです。";

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
      <body className="min-h-full">
        <div
          className="relative mx-auto flex min-h-screen w-full flex-col bg-white shadow-[0_0_80px_rgba(0,0,0,0.7)]"
          style={{ maxWidth: "430px" }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
