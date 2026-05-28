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

function logoFor(ai: string) {
  if (ai === "ChatGPT") return "/logos/chatgpt.svg";
  if (ai === "Claude") return "/logos/claude.png";
  if (ai === "Gemini") return "/logos/Gemini.png";
  return "/logos/deepseek.png";
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
        <section className="rounded-3xl bg-gradient-to-br from-blue-700 via-blue-800 to-blue-950 p-5 text-white shadow-xl mb-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-xs opacity-80 font-bold tracking-wide">
                KOMPARI ARENA
              </div>
              <h1 className="text-3xl font-extrabold leading-tight mt-1">
                AIが予測で競う
                <br />
                レースアリーナ
              </h1>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">
              🏇
            </div>
          </div>

          <p className="text-sm opacity-80 leading-6 mb-4">
            ChatGPT、Claude、Gemini、DeepSeekの予測を比較し、
            どのAIが当たるのかを可視化します。
          </p>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/10 p-3 text-center">
              <div className="text-xl font-extrabold">{races.length}</div>
              <div className="text-[10px] opacity-70">登録レース</div>
            </div>

            <div className="rounded-2xl bg-white/10 p-3 text-center">
              <div className="text-xl font-extrabold">4</div>
              <div className="text-[10px] opacity-70">参加AI</div>
            </div>

            <div className="rounded-2xl bg-white/10 p-3 text-center">
              <div className="text-xl font-extrabold">LIVE</div>
              <div className="text-[10px] opacity-70">投票反映</div>
            </div>
          </div>
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
                  {featuredRace.title || "無題のレース"}
                </h2>
              </div>

              <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                {featuredRace.startsIn || "登録済み"}
              </div>
            </div>

            <div className="text-xs text-gray-500 mb-4">
              {featuredRace.venue || "開催場所未入力"}
            </div>

            {featuredConsensus && (
              <div className="rounded-2xl bg-blue-50 p-3 mb-4">
                <div className="text-xs font-bold text-blue-700 mb-1">
                  AIコンセンサス
                </div>

                <div className="flex items-center justify-between">
                  <div className="font-extrabold">
                    ◎ {featuredConsensus.name}
                  </div>

                  <div className="text-sm font-bold text-blue-700">
                    {featuredConsensus.count}/
                    {featuredRace.predictions?.length || 0} AI
                  </div>
                </div>

                <div className="mt-2 h-2 rounded-full bg-white overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-blue-700"
                    style={{
                      width: `${
                        (featuredConsensus.count /
                          (featuredRace.predictions?.length || 1)) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex -space-x-2">
                {(featuredRace.predictions || []).map((prediction) => (
                  <img
                    key={prediction.ai}
                    src={logoFor(prediction.ai)}
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

        <section className="rounded-3xl bg-white p-4 shadow-sm mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">AIランキング</h2>

            <Link href="/ranking" className="text-xs font-bold text-blue-700">
              詳細 →
            </Link>
          </div>

          <div className="space-y-3 text-sm">
            {[
              ["DeepSeek", "74%"],
              ["ChatGPT", "71%"],
              ["Claude", "69%"],
            ].map(([name, rate], index) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-2xl bg-gray-50 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>

                  <img
                    src={logoFor(name)}
                    alt={name}
                    className="w-8 h-8 rounded-full bg-white p-1 object-contain border border-gray-100"
                  />

                  <span className="font-bold">{name}</span>
                </div>

                <span className="font-extrabold text-blue-700">{rate}</span>
              </div>
            ))}
          </div>
        </section>

        <Link
          href="/admin"
          className="block rounded-3xl border border-dashed border-gray-300 bg-white p-4 text-center text-sm font-bold text-gray-500"
        >
          管理画面でレースを追加 →
        </Link>
      </div>

      <BottomNav />
    </main>
  );
}