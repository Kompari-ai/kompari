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
      title: FALLBACK_TITLE,
      description: FALLBACK_DESCRIPTION,
      openGraph: {
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

  const title = `${source.title} | Kompari`;
  const description = `${source.title}をChatGPT・Claude・Gemini・DeepSeek・GrokのAI予測で比較。結果と的中率まで確認できるAI予測メディアです。`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default function EventDetailLayout({ children }: Props) {
  return children;
}
