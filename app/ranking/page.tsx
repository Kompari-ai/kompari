"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";

type Prediction = {
  ai: string;
  main: string;
};

type Race = {
  resultWinner?: string;
  predictions?: Prediction[];
};

const aiList = ["ChatGPT", "Claude", "Gemini", "DeepSeek"];

function logoFor(ai: string) {
  if (ai === "ChatGPT") return "/logos/chatgpt.svg";
  if (ai === "Claude") return "/logos/claude.png";
  if (ai === "Gemini") return "/logos/Gemini.png";
  return "/logos/deepseek.png";
}

export default function RankingPage() {
  const [races, setRaces] = useState<Race[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "races"), (snapshot) => {
      const list = snapshot.docs.map((doc) => doc.data()) as Race[];
      setRaces(list);
    });

    return () => unsubscribe();
  }, []);

  const rankings = useMemo(() => {
    return aiList
      .map((ai) => {
        let total = 0;
        let hits = 0;

        races.forEach((race) => {
          if (!race.resultWinner) return;

          const prediction = race.predictions?.find((p) => p.ai === ai);
          if (!prediction?.main) return;

          total += 1;

          if (prediction.main === race.resultWinner) {
            hits += 1;
          }
        });

        const rate = total === 0 ? 0 : Math.round((hits / total) * 100);

        return { ai, total, hits, rate };
      })
      .sort((a, b) => b.rate - a.rate || b.hits - a.hits);
  }, [races]);

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <TopBar />

      <div className="max-w-[430px] mx-auto px-4 py-4 pb-24">
        <section className="bg-gradient-to-br from-blue-700 to-blue-950 rounded-3xl p-5 text-white mb-5 shadow-lg">
          <div className="text-xs opacity-80 mb-2">
            AI PREDICTION ARENA
          </div>

          <h1 className="text-2xl font-extrabold mb-2">
            AI的中率ランキング
          </h1>

          <p className="text-sm opacity-80 leading-6">
            レース結果が登録されたデータから、各AIの本命的中率を自動集計します。
          </p>
        </section>

        <section className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">本命的中率</h2>
            <span className="text-xs text-gray-500">Firestore連動</span>
          </div>

          <div className="space-y-3">
            {rankings.map((item, index) => (
              <Link
                key={item.ai}
                href={`/ai/${item.ai.toLowerCase()}`}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold ${
                    index === 0
                      ? "bg-yellow-100 text-yellow-700"
                      : index === 1
                      ? "bg-gray-100 text-gray-600"
                      : index === 2
                      ? "bg-orange-100 text-orange-700"
                      : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {index + 1}
                </div>

                <img
                  src={logoFor(item.ai)}
                  alt={item.ai}
                  className="w-10 h-10 rounded-full bg-gray-50 p-2 object-contain"
                />

                <div className="flex-1">
                  <div className="font-bold">{item.ai}</div>
                  <div className="text-xs text-gray-500">
                    的中 {item.hits} / 予想 {item.total}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-extrabold text-blue-700">
                    {item.rate}%
                  </div>
                  <div className="text-[10px] text-gray-500">的中率</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold mb-3">集計ルール</h2>

          <p className="text-sm leading-7 text-gray-700">
            結果が登録されたレースだけを対象に、各AIの本命馬が1着馬と一致した場合を「的中」として集計します。
          </p>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}