"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";

type Race = {
  id: string;
  title?: string;
  venue?: string;
  startsIn?: string;
  predictions?: {
    ai: string;
    main: string;
    second?: string;
    third?: string;
    reason?: string;
  }[];
};

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

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <TopBar />

      <div className="max-w-[430px] mx-auto px-4 py-4 pb-24">
        <section className="rounded-3xl bg-gradient-to-br from-blue-700 to-blue-950 p-5 text-white shadow-lg mb-5">
          <div className="text-xs opacity-80 mb-2">RACES</div>
          <h1 className="text-2xl font-extrabold">登録レース一覧</h1>
          <p className="text-sm opacity-80 mt-2">
            管理画面から登録したレースを表示します。
          </p>
        </section>

        <div className="space-y-3">
          {races.map((race) => {
            const firstPrediction = race.predictions?.[0];

            return (
              <Link
                key={race.id}
                href={`/race/${race.id}`}
                className="block bg-white rounded-3xl p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold">{race.title}</h2>
                  <span className="text-xs text-blue-700 font-bold">
                    {race.startsIn || "登録済み"}
                  </span>
                </div>

                <div className="text-xs text-gray-500 mb-3">
                  {race.venue}
                </div>

                {firstPrediction && (
                  <div className="rounded-2xl bg-blue-50 p-3 text-sm">
                    <div className="text-xs text-blue-700 font-bold mb-1">
                      {firstPrediction.ai} の本命
                    </div>
                    <div className="font-bold">{firstPrediction.main}</div>
                  </div>
                )}
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