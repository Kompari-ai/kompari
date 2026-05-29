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
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [startsIn, setStartsIn] = useState("");
  const [resultWinner, setResultWinner] = useState("");
  const [saving, setSaving] = useState(false);

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

  const updatePrediction = (
    index: number,
    key: keyof PredictionInput,
    value: string
  ) => {
    const next = [...predictions];
    next[index] = { ...next[index], [key]: value };
    setPredictions(next);
  };

  const generatePredictions = async () => {
    if (!title) {
      alert("先にレース名を入力してください");
      return;
    }

    setSaving(true);

    try {
      const results = await Promise.all(
        aiNames.map(async (aiName) => {
          const res = await fetch("/api/generate-prediction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, venue, aiName }),
          });

          if (!res.ok) {
            throw new Error("AI生成に失敗しました");
          }

          return res.json();
        })
      );

      setPredictions(results);
    } catch (error) {
      console.error(error);
      alert("AI予測の生成に失敗しました");
    }

    setSaving(false);
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
        resultWinner,
        predictions: validPredictions,
        createdAt: serverTimestamp(),
      });

      alert("保存しました");

      setTitle("");
      setVenue("");
      setStartsIn("");
      setResultWinner("");
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

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
        <div className="max-w-[430px] mx-auto px-4 py-20">
          <section className="bg-white rounded-3xl p-5 shadow-sm">
            <h1 className="text-2xl font-extrabold mb-3">管理画面ログイン</h1>

            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="管理パスワード"
              className="w-full rounded-xl border border-gray-200 px-3 py-3 mb-4"
            />

            <button
              onClick={() => {
                if (password === "kompari-admin") {
                  setUnlocked(true);
                } else {
                  alert("パスワードが違います");
                }
              }}
              className="w-full rounded-2xl bg-blue-700 text-white py-4 font-bold"
            >
              ログイン
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <TopBar />

      <div className="max-w-[430px] mx-auto px-4 py-4">
        <section className="rounded-3xl bg-blue-700 p-5 text-white mb-5">
          <div className="text-xs opacity-80 mb-2">ADMIN</div>
          <h1 className="text-2xl font-extrabold">レース登録</h1>
          <p className="text-sm opacity-80 mt-2">
            AI予測を自動生成して、結果も登録できます。
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
            placeholder="結果：1着馬名（後から入力でもOK）"
            className="w-full rounded-xl border border-gray-200 px-3 py-3"
          />
        </section>

        <button
          onClick={generatePredictions}
          disabled={saving}
          className="mb-5 w-full rounded-2xl bg-black text-white py-4 font-bold disabled:opacity-50"
        >
          {saving ? "生成中..." : "AI予測を生成"}
        </button>

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
                placeholder="信頼度"
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
                placeholder="データ根拠"
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