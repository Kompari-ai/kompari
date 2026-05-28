"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { TopBar } from "@/components/TopBar";

const aiNames = ["ChatGPT", "Claude", "Gemini", "DeepSeek"];

type PredictionInput = {
  ai: string;
  main: string;
  second: string;
  third: string;
  confidence: string;
  reason: string;
  evidence: string;
};

export default function AdminPage() {
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [startsIn, setStartsIn] = useState("");

  const [predictions, setPredictions] = useState<PredictionInput[]>(
    aiNames.map((ai) => ({
      ai,
      main: "",
      second: "",
      third: "",
      confidence: "",
      reason: "",
      evidence: "",
    }))
  );

  const [saving, setSaving] = useState(false);

  const updatePrediction = (
    index: number,
    key: keyof PredictionInput,
    value: string
  ) => {
    const next = [...predictions];

    next[index] = {
      ...next[index],
      [key]: value,
    };

    setPredictions(next);
  };

  const saveRace = async () => {
    if (!title) {
      alert("レース名は必須です");
      return;
    }

    const validPredictions = predictions.filter((p) => p.main);

    if (validPredictions.length === 0) {
      alert("最低1つのAI予測を入力してください");
      return;
    }

    setSaving(true);

    try {
      await addDoc(collection(db, "races"), {
        title,
        venue,
        startsIn,
        predictions: validPredictions,
        createdAt: serverTimestamp(),
      });

      alert("保存しました");

      setTitle("");
      setVenue("");
      setStartsIn("");

      setPredictions(
        aiNames.map((ai) => ({
          ai,
          main: "",
          second: "",
          third: "",
          confidence: "",
          reason: "",
          evidence: "",
        }))
      );
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

          <h1 className="text-2xl font-extrabold">
            レース登録
          </h1>

          <p className="text-sm opacity-80 mt-2">
            4つのAI予測をまとめて登録できます。
          </p>
        </section>

        <section className="bg-white rounded-3xl p-4 shadow-sm space-y-4 mb-5">
          <div>
            <label className="text-xs font-bold text-gray-500">
              レース名
            </label>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="日本ダービー(G1)"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">
              開催場所
            </label>

            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="東京競馬場・芝2400m"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">
              発走まで
            </label>

            <input
              value={startsIn}
              onChange={(e) => setStartsIn(e.target.value)}
              placeholder="45分"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3"
            />
          </div>
        </section>

        <div className="space-y-4">
          {predictions.map((prediction, index) => (
            <section
              key={prediction.ai}
              className="bg-white rounded-3xl p-4 shadow-sm"
            >
              <div className="font-extrabold text-blue-700 mb-3">
                {prediction.ai}
              </div>

              <input
                value={prediction.main}
                onChange={(e) =>
                  updatePrediction(index, "main", e.target.value)
                }
                placeholder="◎ 本命"
                className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-3"
              />

              <input
                value={prediction.second}
                onChange={(e) =>
                  updatePrediction(index, "second", e.target.value)
                }
                placeholder="○ 対抗"
                className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-3"
              />

              <input
                value={prediction.third}
                onChange={(e) =>
                  updatePrediction(index, "third", e.target.value)
                }
                placeholder="▲ 穴"
                className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-3"
              />

              <input
                value={prediction.confidence}
                onChange={(e) =>
                  updatePrediction(index, "confidence", e.target.value)
                }
                placeholder="信頼度 例：72"
                className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-3"
              />

              <textarea
                value={prediction.reason}
                onChange={(e) =>
                  updatePrediction(index, "reason", e.target.value)
                }
                placeholder="予測理由"
                className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-3 min-h-24"
              />

              <textarea
                value={prediction.evidence}
                onChange={(e) =>
                  updatePrediction(index, "evidence", e.target.value)
                }
                placeholder="データ根拠 例：上がり3F最速 / 東京2400m適性◎"
                className="w-full rounded-xl border border-gray-200 px-3 py-3 min-h-24"
              />
            </section>
          ))}
        </div>

        <button
          onClick={saveRace}
          disabled={saving}
          className="mt-5 mb-10 w-full rounded-2xl bg-blue-700 text-white py-4 font-bold disabled:opacity-50"
        >
          {saving ? "保存中..." : "Firestoreに保存"}
        </button>
      </div>
    </main>
  );
}
