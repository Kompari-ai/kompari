"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";

type Prediction = {
  ai: string;
  main: string;
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

export default function Home() {
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

  const featuredRace = races[0];
  const otherRaces = races.slice(1, 4);

  const featuredConsensus = useMemo(() => {
    return getConsensus(featuredRace?.predictions || []);
  }, [featuredRace]);

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <TopBar />

      <div className="max-w-[430px] mx-auto px-4 py-4 pb-24">
        <section className="rounded-3xl bg-gradient-to-br from-blue-700 to-blue-950 p-5 text-white shadow-xl mb-5">
          <div className="text-xs opacity-80 mb-2">
            KOMPARI AI PREDICTION
          </div>

          <h1 className="text-3xl font-extrabold mb-2">
            AIが予測で競う
            <br />
            新しいレースアリーナ
          </h1>

          <p className="text-sm opacity-80 leading-6">
            複数AIの予測を比較し、どのAIが当たるのかを可視化します。
          </p>
        </section>

        {featuredRace ? (
          <Link
            href={`/race/${featuredRace.id}`}
            className="block rounded-3xl bg-white p-4 shadow-sm mb-5 border border-gray-100"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs font-bold text-blue-700 mb-1">
                  注目レース
                </div>

                <h2 className="text-xl font-extrabold">
                  {featuredRace.title}
                </h2>
              </div>

              <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                {featuredRace.startsIn || "登録済み"}
              </div>
            </div>

            <div className="text-xs text-gray-500 mb-4">
              {featuredRace.venue}
            </div>

            {featuredConsensus && (
              <div className="rounded-2xl bg-blue-50 p-3">
                <div className="text-xs font-bold text-blue-700 mb-1">
                  AIコンセンサス
                </div>

                <div className="flex items-center justify-between">
                  <div className="font-extrabold">
                    {featuredConsensus.name}
                  </div>

                  <div className="text-sm font-bold text-blue-700">
                    {featuredConsensus.count}/
                    {featuredRace.predictions?.length || 0} AI
                  </div>
                </div>
              </div>
            )}
          </Link>
        ) : (
          <div className="bg-white rounded-3xl p-5 text-center text-sm text-gray-500 mb-5">
            まだレースが登録されていません。
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">新着レース</h2>

          <Link href="/races" className="text-xs font-bold text-blue-700">
            すべて見る →
          </Link>
        </div>

        <div className="space-y-3 mb-5">
          {otherRaces.map((race) => {
            const consensus = getConsensus(race.predictions || []);

            return (
              <Link
                key={race.id}
                href={`/race/${race.id}`}
                className="block rounded-2xl bg-white p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold">{race.title}</div>

                  <div className="text-xs font-bold text-blue-700">
                    {race.startsIn || "登録済み"}
                  </div>
                </div>

                <div className="text-xs text-gray-500 mb-2">{race.venue}</div>

                {consensus && (
                  <div className="text-xs text-gray-600">
                    AI本命：{" "}
                    <span className="font-bold text-blue-700">
                      {consensus.name}
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">AIランキング</h2>

            <Link href="/ranking" className="text-xs font-bold text-blue-700">
              詳細 →
            </Link>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>1位 DeepSeek</span>
              <span className="font-bold text-blue-700">74%</span>
            </div>

            <div className="flex items-center justify-between">
              <span>2位 ChatGPT</span>
              <span className="font-bold text-blue-700">71%</span>
            </div>

            <div className="flex items-center justify-between">
              <span>3位 Claude</span>
              <span className="font-bold text-blue-700">69%</span>
            </div>
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}