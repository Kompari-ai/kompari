"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";

type Prediction = {
  ai: string;
  main: string;
  second?: string;
  third?: string;
  confidence?: string;
  reason?: string;
  evidence?: string;
};

type Race = {
  id: string;
  title?: string;
  venue?: string;
  startsIn?: string;
  predictions?: Prediction[];
};

function getConsensus(predictions: Prediction[] = []) {
  const counts: Record<string, number> = {};

  predictions.forEach((prediction) => {
    if (!prediction.main) return;
    counts[prediction.main] = (counts[prediction.main] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)[0];
}

export default function RacesPage() {
  const [races, setRaces] = useState<Race[]>([]);

  useEffect(() => {
    const q = query(collection(db, "races"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Race[];

      setRaces(list);
    });

    return () => unsubscribe();
  }, []);

  const total = useMemo(() => races.length, [races]);

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <TopBar />

      <div className="max-w-[430px] mx-auto px-4 py-4 pb-24">
        <section className="rounded-3xl bg-gradient-to-br from-blue-700 to-blue-950 p-5 text-white shadow-lg mb-5">
          <div className="text-xs opacity-80 mb-2">RACE ARENA</div>

          <h1 className="text-2xl font-extrabold mb-2">
            AI予測レース一覧
          </h1>

          <p className="text-sm opacity-80 leading-6">
            登録されたレースをAIコンセンサス順に確認できます。
          </p>

          <div className="mt-4 rounded-2xl bg-white/10 p-3">
            <div className="text-xs opacity-70">登録レース数</div>
            <div className="text-2xl font-extrabold">{total}件</div>
          </div>
        </section>

        <div className="space-y-4">
          {races.map((race) => {
            const predictions = race.predictions || [];
            const consensus = getConsensus(predictions);

            return (
              <Link
                key={race.id}
                href={`/race/${race.id}`}
                className="block rounded-3xl bg-white p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs font-bold text-blue-700 mb-1">
                      AI RACE ANALYSIS
                    </div>

                    <h2 className="text-lg font-extrabold">
                      {race.title || "無題のレース"}
                    </h2>
                  </div>

                  <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                    {race.startsIn || "登録済み"}
                  </div>
                </div>

                <div className="text-xs text-gray-500 mb-4">
                  {race.venue || "開催場所未入力"}
                </div>

                {consensus && (
                  <div className="rounded-2xl bg-blue-50 p-3 mb-3">
                    <div className="text-xs font-bold text-blue-700 mb-1">
                      AIコンセンサス
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="font-extrabold">{consensus.name}</div>

                      <div className="text-sm font-bold text-blue-700">
                        {consensus.count}/{predictions.length} AI
                      </div>
                    </div>

                    <div className="mt-2 h-2 rounded-full bg-white overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-blue-700"
                        style={{
                          width: `${(consensus.count / predictions.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {predictions.map((prediction) => (
                      <img
                        key={prediction.ai}
                        src={
                          prediction.ai === "ChatGPT"
                            ? "/logos/chatgpt.svg"
                            : prediction.ai === "Claude"
                            ? "/logos/claude.png"
                            : prediction.ai === "Gemini"
                            ? "/logos/Gemini.png"
                            : "/logos/deepseek.png"
                        }
                        alt={prediction.ai}
                        className="w-8 h-8 rounded-full bg-white border border-gray-200 p-1 object-contain"
                      />
                    ))}
                  </div>

                  <div className="text-xs font-bold text-gray-500">
                    詳細を見る →
                  </div>
                </div>
              </Link>
            );
          })}

          {races.length === 0 && (
            <div className="bg-white rounded-3xl p-5 text-center text-sm text-gray-500">
              まだレースが登録されていません。
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}