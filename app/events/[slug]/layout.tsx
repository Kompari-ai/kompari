// Server component. Adds dynamic metadata/OGP for the event detail route
// without touching the existing "use client" page.tsx (CSR + onSnapshot untouched).
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getEventMetadataSource } from "@/lib/firebase-server";

type Props = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

const FALLBACK_TITLE = "Kompari | AI予測比較";
const FALLBACK_DESCRIPTION =
  "Kompariは、複数AIの予測を比較し、結果と的中率まで確認できるAI予測メディアです。";

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  const source = await getEventMetadataSource(slug);

  const url = `https://kompari.vercel.app/events/${slug}`;

  if (!source) {
    return {
      // absolute: root layout の title.template("%s | Kompari")をバイパスする。
      // FALLBACK_TITLE 自体が既に "Kompari" を含むため、templateを適用すると二重になる。
      title: { absolute: FALLBACK_TITLE },
      description: FALLBACK_DESCRIPTION,
      openGraph: {
        // openGraph/twitterのtitleはtemplate非適用(OGカード表示用の独立指定)のため、
        // 元の文字列のままでよい。
        title: FALLBACK_TITLE,
        description: FALLBACK_DESCRIPTION,
        url,
        type: "website",
      },
      twitter: {
        card: "summary",
        title: FALLBACK_TITLE,
        description: FALLBACK_DESCRIPTION,
      },
    };
  }

  // document <title> 用。root layout の title.template("%s | Kompari")が
  // "| Kompari" を付与するため、ここでは event.title のみを渡す。
  const pageTitle = source.title;
  // openGraph/twitter用。templateが効かないため "| Kompari" をここで明示する。
  const ogTitle = `${source.title} | Kompari`;
  const description = `${source.title}をChatGPT・Claude・Gemini・DeepSeek・GrokのAI予測で比較。結果と的中率まで確認できるAI予測メディアです。`;

  return {
    title: pageTitle,
    description,
    openGraph: {
      title: ogTitle,
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: ogTitle,
      description,
    },
  };
}

export default function EventDetailLayout({ children }: Props) {
  return children;
}
