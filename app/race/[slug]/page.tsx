"use client";

import { use, useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";

type Prediction = {
  ai: string;
  main: string;
  second?: string;
  third?: string;
  reason?: string;
};

type Race = {
  title?: string;
  venue?: string;
  startsIn?: string;
  predictions?: Prediction[];
};

export default function RaceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [race, setRace] = useState<Race | null>(null);

  useEffect(() => {
    const ref = doc(db, "races", slug);

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      if (snapshot.exists()) {
        setRace(snapshot.data() as Race);
      }
    });

    return () => unsubscribe();
  }, [slug]);

  if (!race) {
    return (
      <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
        <TopBar />
        <div className="max-w-[430px] mx-auto px-4 py-10 text-center text-gray-500">
          読み込み中...
        </div>
        <BottomNav />
      </main>
    );
  }

  const predictions = race.predictions || [];
  const topPrediction = predictions[0];

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <TopBar />

      <div className="max-w-[430px] mx-auto px-4 py-4 pb-24">
        <section className="rounded-3xl bg-gradient-to-br from-[#0f172a] to-[#1e3a8a] p-5 text-white shadow-xl mb-5">
          <div className="text-xs opacity-70 mb-2">AI RACE ANALYSIS</div>

          <h1 className="text-3xl font-extrabold mb-2">{race.title}</h1>

          <div className="flex gap-2 text-xs opacity-80 mb-4">
            <span>{race.venue}</span>
            <span>{race.startsIn}</span>
          </div>

          {topPrediction && (
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <div className="text-xs opacity-70 mb-1">AI総合本命</div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-extrabold">
                    {topPrediction.main}
                  </div>

                  <div className="text-sm opacity-80">
                    {topPrediction.ai} 推奨
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-3xl font-extrabold text-yellow-300">
                    ◎
                  </div>

                  <div className="text-xs opacity-70">本命</div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="bg-white rounded-3xl shadow-sm p-4 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">各AIの予測</h2>
            <span className="text-xs text-gray-500">
              {predictions.length} AI
            </span>
          </div>

          <div className="space-y-4">
            {predictions.map((prediction) => (
              <div
                key={prediction.ai}
                className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-extrabold text-blue-700">
                      {prediction.ai}
                    </div>
                    <div className="text-xs text-gray-500">AI予測</div>
                  </div>

                  <div className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700">
                    ◎ {prediction.main}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="rounded-2xl bg-yellow-50 p-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">◎ 本命</div>
                    <div className="font-bold text-sm">{prediction.main}</div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">○ 対抗</div>
                    <div className="font-bold text-sm">
                      {prediction.second || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-orange-50 p-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">▲ 穴</div>
                    <div className="font-bold text-sm">
                      {prediction.third || "-"}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-blue-50 p-4">
                  <p className="text-sm leading-7 text-gray-700">
                    {prediction.reason || "予測理由は未入力です。"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}