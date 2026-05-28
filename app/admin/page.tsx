"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { TopBar } from "@/components/TopBar";

export default function AdminPage() {
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [startsIn, setStartsIn] = useState("");
  const [aiName, setAiName] = useState("ChatGPT");
  const [main, setMain] = useState("");
  const [second, setSecond] = useState("");
  const [third, setThird] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const saveRace = async () => {
    if (!title || !main) {
      alert("レース名と本命は必須です");
      return;
    }

    setSaving(true);

    try {
      await addDoc(collection(db, "races"), {
        title,
        venue,
        startsIn,
        predictions: [
          {
            ai: aiName,
            main,
            second,
            third,
            reason,
          },
        ],
        createdAt: serverTimestamp(),
      });

      alert("保存しました");

      setTitle("");
      setVenue("");
      setStartsIn("");
      setMain("");
      setSecond("");
      setThird("");
      setReason("");
    } catch (error) {
      console.error(error);
      alert("保存に失敗しました");
    }

    setSaving(false);
  };

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <TopBar />

      <div className="max-w-[430px] mx-auto px-4 py-4">
        <section className="rounded-3xl bg-blue-700 p-5 text-white mb-5">
          <div className="text-xs opacity-80 mb-2">ADMIN</div>
          <h1 className="text-2xl font-extrabold">レース登録</h1>
          <p className="text-sm opacity-80 mt-2">
            まずは手入力でレースとAI予測を登録します。
          </p>
        </section>

        <section className="bg-white rounded-3xl p-4 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500">レース名</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="日本ダービー(G1)"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">開催場所</label>
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="東京競馬場・芝2400m"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">発走まで</label>
            <input
              value={startsIn}
              onChange={(e) => setStartsIn(e.target.value)}
              placeholder="45分"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">AI名</label>
            <select
              value={aiName}
              onChange={(e) => setAiName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3"
            >
              <option>ChatGPT</option>
              <option>Claude</option>
              <option>Gemini</option>
              <option>DeepSeek</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">◎ 本命</label>
            <input
              value={main}
              onChange={(e) => setMain(e.target.value)}
              placeholder="イクイノックス"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">○ 対抗</label>
            <input
              value={second}
              onChange={(e) => setSecond(e.target.value)}
              placeholder="ドウデュース"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">▲ 穴</label>
            <input
              value={third}
              onChange={(e) => setThird(e.target.value)}
              placeholder="サトノクラウン"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">予測理由</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="東京2400mの適性と直近成績から..."
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 min-h-28"
            />
          </div>

          <button
            onClick={saveRace}
            disabled={saving}
            className="w-full rounded-2xl bg-blue-700 text-white py-4 font-bold disabled:opacity-50"
          >
            {saving ? "保存中..." : "Firestoreに保存"}
          </button>
        </section>
      </div>
    </main>
  );
}