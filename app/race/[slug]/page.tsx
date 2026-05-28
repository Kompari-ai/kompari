"use client";

import { use, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";

type Vote = {
  ai?: string;
  type?: "good" | "bad";
};

const aiData: Record<string, { name: string; description: string; color: string }> = {
  deepseek: {
    name: "DeepSeek",
    description: "競馬・競艇など数値予測系に強いAI。",
    color: "from-blue-700 to-cyan-700",
  },
  chatgpt: {
    name: "ChatGPT",
    description: "総合分析能力が高く、多分野対応型AI。",
    color: "from-green-600 to-emerald-700",
  },
  claude: {
    name: "Claude",
    description: "展開予測・文章分析が得意なAI。",
    color: "from-orange-500 to-red-500",
  },
  gemini: {
    name: "Gemini",
    description: "Google系データ分析に強いAI。",
    color: "from-purple-600 to-pink-600",
  },
};

function logoFor(ai: string) {
  if (ai === "ChatGPT") return "/logos/chatgpt.svg";
  if (ai === "Claude") return "/logos/claude.png";
  if (ai === "Gemini") return "/logos/Gemini.png";
  return "/logos/deepseek.png";
}

export default function AiProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const ai = aiData[slug] || aiData.chatgpt;

  const [votes, setVotes] = useState<Vote[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "votes"), (snapshot) => {
      const list = snapshot.docs.map((doc) => doc.data()) as Vote[];
      setVotes(list);
    });

    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    const aiVotes = votes.filter((vote) => vote.ai === ai.name);
    const good = aiVotes.filter((vote) => vote.type === "good").length;
    const bad = aiVotes.filter((vote) => vote.type === "bad").length;
    const total = good + bad;
    const goodRate = total === 0 ? 0 : Math.round((good / total) * 100);

    return { good, bad, total, goodRate };
  }, [votes, ai.name]);

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <TopBar />

      <div className="max-w-[430px] mx-auto px-4 py-4 pb-24">
        <section
          className={`rounded-3xl bg-gradient-to-br ${ai.color} p-5 text-white shadow-lg mb-5`}
        >
          <div className="flex items-center gap-4 mb-4">
            <img
              src={logoFor(ai.name)}
              alt={ai.name}
              className="w-14 h-14 rounded-2xl bg-white p-2 object-contain"
            />

            <div>
              <div className="text-xs opacity-80 mb-1">AI PROFILE</div>
              <h1 className="text-3xl font-extrabold">{ai.name}</h1>
            </div>
          </div>

          <p className="text-sm opacity-80 leading-6">{ai.description}</p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/10 p-3 text-center">
              <div className="text-2xl font-extrabold text-yellow-300">
                {stats.goodRate}%
              </div>
              <div className="text-[10px] opacity-70">Good率</div>
            </div>

            <div className="rounded-2xl bg-white/10 p-3 text-center">
              <div className="text-2xl font-extrabold">{stats.good}</div>
              <div className="text-[10px] opacity-70">Good</div>
            </div>

            <div className="rounded-2xl bg-white/10 p-3 text-center">
              <div className="text-2xl font-extrabold">{stats.bad}</div>
              <div className="text-[10px] opacity-70">Bad</div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow-sm p-4 mb-5">
          <h2 className="font-bold mb-4">ユーザー評価</h2>

          <div className="mb-2 flex justify-between text-sm">
            <span>Good率</span>
            <span className="font-bold text-blue-700">{stats.goodRate}%</span>
          </div>

          <div className="h-3 rounded-full bg-gray-100 overflow-hidden mb-4">
            <div
              className="h-3 rounded-full bg-blue-700"
              style={{ width: `${stats.goodRate}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-2xl bg-blue-50 p-3">
              <div className="font-extrabold text-blue-700">{stats.total}</div>
              <div className="text-xs text-gray-500">総投票</div>
            </div>

            <div className="rounded-2xl bg-green-50 p-3">
              <div className="font-extrabold text-green-700">{stats.good}</div>
              <div className="text-xs text-gray-500">Good</div>
            </div>

            <div className="rounded-2xl bg-red-50 p-3">
              <div className="font-extrabold text-red-700">{stats.bad}</div>
              <div className="text-xs text-gray-500">Bad</div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow-sm p-4">
          <h2 className="font-bold mb-3">今後追加予定</h2>

          <p className="text-sm leading-7 text-gray-700">
            正式版では、ユーザー評価だけでなく、実際の的中率・分野別成績・レースごとの予測履歴も表示します。
          </p>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}