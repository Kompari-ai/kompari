"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";

type Vote = {
  ai?: string;
  type?: "good" | "bad";
};

const aiList = ["ChatGPT", "Claude", "Gemini", "DeepSeek"];

function logoFor(ai: string) {
  if (ai === "ChatGPT") return "/logos/chatgpt.svg";
  if (ai === "Claude") return "/logos/claude.png";
  if (ai === "Gemini") return "/logos/Gemini.png";
  return "/logos/deepseek.png";
}

export default function RankingPage() {
  const [votes, setVotes] = useState<Vote[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "votes"), (snapshot) => {
      const list = snapshot.docs.map((doc) => doc.data()) as Vote[];
      setVotes(list);
    });

    return () => unsubscribe();
  }, []);

  const rankings = useMemo(() => {
    return aiList
      .map((ai) => {
        const aiVotes = votes.filter((vote) => vote.ai === ai);
        const good = aiVotes.filter((vote) => vote.type === "good").length;
        const bad = aiVotes.filter((vote) => vote.type === "bad").length;
        const total = good + bad;
        const rate = total === 0 ? 0 : Math.round((good / total) * 100);

        return {
          ai,
          good,
          bad,
          total,
          rate,
        };
      })
      .sort((a, b) => b.rate - a.rate || b.total - a.total);
  }, [votes]);

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <TopBar />

      <div className="max-w-[430px] mx-auto px-4 py-4 pb-24">
        <section className="bg-gradient-to-br from-blue-700 to-blue-950 rounded-3xl p-5 text-white mb-5 shadow-lg">
          <div className="text-xs opacity-80 mb-2">
            AI PREDICTION ARENA
          </div>

          <h1 className="text-2xl font-extrabold mb-2">
            AI評価ランキング
          </h1>

          <p className="text-sm opacity-80 leading-6">
            ユーザーのGood / Bad投票をもとに、各AIの評価をリアルタイム集計します。
          </p>
        </section>

        <section className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">ユーザー評価ランキング</h2>
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
                    Good {item.good} / Bad {item.bad}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-extrabold text-blue-700">
                    {item.rate}%
                  </div>
                  <div className="text-[10px] text-gray-500">
                    Good率
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold mb-3">評価の見方</h2>

          <p className="text-sm leading-7 text-gray-700">
            このランキングは的中率ではなく、ユーザーが「良い予想」と評価した割合です。
            正式版では、実際の的中結果を反映したランキングも追加予定です。
          </p>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}