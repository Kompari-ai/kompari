"use client";

import { use, useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { TopBar } from "@/components/TopBar";

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
  title?: string;
  venue?: string;
  startsIn?: string;
  resultWinner?: string;
  predictions?: Prediction[];
};

export default function EditRacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [race, setRace] = useState<Race | null>(null);
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [startsIn, setStartsIn] = useState("");
  const [resultWinner, setResultWinner] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ref = doc(db, "races", id);

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Race;
        setRace(data);
        setTitle(data.title || "");
        setVenue(data.venue || "");
        setStartsIn(data.startsIn || "");
        setResultWinner(data.resultWinner || "");
      }
    });

    return () => unsubscribe();
  }, [id]);

  const saveEdit = async () => {
    setSaving(true);

    try {
      await updateDoc(doc(db, "races", id), {
        title,
        venue,
        startsIn,
        resultWinner,
      });

      alert("更新しました");
    } catch (error) {
      console.error(error);
      alert("更新に失敗しました");
    }

    setSaving(false);
  };

  if (!race) {
    return (
      <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
        <TopBar />
        <div className="max-w-[430px] mx-auto px-4 py-10 text-center text-gray-500">
          読み込み中...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <TopBar />

      <div className="max-w-[430px] mx-auto px-4 py-4">
        <section className="rounded-3xl bg-blue-700 p-5 text-white mb-5">
          <div className="text-xs opacity-80 mb-2">ADMIN EDIT</div>
          <h1 className="text-2xl font-extrabold">レース編集</h1>
          <p className="text-sm opacity-80 mt-2">
            レース終了後に1着馬を入力できます。
          </p>
        </section>

        <section className="bg-white rounded-3xl p-4 shadow-sm space-y-4 mb-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="レース名"
            className="w-full rounded-xl border border-gray-200 px-3 py-3"
          />

          <input
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="開催場所"
            className="w-full rounded-xl border border-gray-200 px-3 py-3"
          />

          <input
            value={startsIn}
            onChange={(e) => setStartsIn(e.target.value)}
            placeholder="発走まで"
            className="w-full rounded-xl border border-gray-200 px-3 py-3"
          />

          <input
            value={resultWinner}
            onChange={(e) => setResultWinner(e.target.value)}
            placeholder="結果：1着馬名"
            className="w-full rounded-xl border border-gray-200 px-3 py-3"
          />
        </section>

        <button
          onClick={saveEdit}
          disabled={saving}
          className="w-full rounded-2xl bg-blue-700 text-white py-4 font-bold disabled:opacity-50"
        >
          {saving ? "更新中..." : "更新する"}
        </button>
      </div>
    </main>
  );
}