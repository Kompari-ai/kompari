"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import {
  eventCategories,
  getCategoryEmoji,
  getCategoryLabel,
} from "@/lib/categories";
import type { KompariPrediction } from "@/lib/events";

const officialAis = ["ChatGPT", "Claude", "Gemini", "DeepSeek", "Grok"];

export default function AdminPage() {
  const router = useRouter();

  const [category, setCategory] = useState("horse_racing");
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [candidateText, setCandidateText] = useState("");
  const [resultWinner, setResultWinner] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [predictions, setPredictions] = useState<KompariPrediction[]>([]);

  const candidates = candidateText
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const canCreate = title.trim().length > 0 && candidates.length >= 2;

  const generatePredictions = async () => {
    if (!canCreate) {
      alert("イベント名と候補を2つ以上入力してください");
      return;
    }

    try {
      setGenerating(true);

      const generated: KompariPrediction[] = [];

      for (const aiName of officialAis) {
        const response = await fetch("/api/generate-prediction", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: title.trim(),
            category,
            aiName,
            candidates,
          }),
        });

        if (!response.ok) {
          throw new Error(`${aiName}の予測生成に失敗しました`);
        }

        const data = (await response.json()) as KompariPrediction;

        generated.push({
          ...data,
          ai: aiName,
          source: "official",
        });
      }

      setPredictions(generated);
    } catch (error) {
      console.error(error);
      alert("AI予測の生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const createPredictionsBeforeSave = async () => {
    const generated: KompariPrediction[] = [];

    for (const aiName of officialAis) {
      const response = await fetch("/api/generate-prediction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          category,
          aiName,
          candidates,
        }),
      });

      if (!response.ok) {
        throw new Error(`${aiName}の予測生成に失敗しました`);
      }

      const data = (await response.json()) as KompariPrediction;

      generated.push({
        ...data,
        ai: aiName,
        source: "official",
      });
    }

    return generated;
  };

  const createEvent = async () => {
    if (!canCreate) {
      alert("イベント名と候補を2つ以上入力してください");
      return;
    }

    try {
      setSaving(true);

      const finalPredictions =
        predictions.length > 0
          ? predictions
          : await createPredictionsBeforeSave();

      const eventRef = doc(collection(db, "events"));
      const eventId = eventRef.id;

      const batch = writeBatch(db);

      // events 本体
      batch.set(eventRef, {
        slug: eventId,
        category,
        title: title.trim(),
        candidates,
        venue: venue.trim(),
        startsAt: startsAt || null,
        result: resultWinner ? { winner: resultWinner } : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        predictionCount: finalPredictions.length,
      });

      // predictions サブコレクション
      for (const pred of finalPredictions) {
        const rawId = pred.myAiId || pred.ai || "unknown";
        const predictionId = String(rawId).replace(/\//g, "_").trim() || "unknown";
        batch.set(doc(db, "events", eventId, "predictions", predictionId), {
          ...pred,                       // isMock/predictionSource/ai/main/aiModel等を流用
          eventId,
          predictionId,
          outcome: "pending",            // 作成時は常に pending
          predictedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // createdAt は入れない(predictedAtと重複するため)
        });
      }

      await batch.commit();

      alert("イベントを作成しました");
      router.push(`/race/${eventId}`);
    } catch (error) {
      console.error(error);
      alert(
        "イベント作成に失敗しました。Googleログイン中のメールアドレスとFirestoreルールを確認してください。"
      );
    } finally {
      setSaving(false);
    }
  };

  const clearForm = () => {
    setTitle("");
    setVenue("");
    setStartsAt("");
    setCandidateText("");
    setResultWinner("");
    setPredictions([]);
  };

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#111827]">
      <TopBar />

      <div className="mx-auto max-w-[430px] px-4 pb-28 pt-4">
        <section className="mb-5 overflow-hidden rounded-[32px] bg-white shadow-sm">
          <div
            className="p-5 text-white"
            style={{
              background:
                "linear-gradient(135deg, #2563eb 0%, #1d4ed8 45%, #172554 100%)",
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold tracking-[0.18em] text-white">
                ADMIN
              </span>

              <span className="rounded-full bg-white px-4 py-2 text-xs font-extrabold text-blue-700">
                作成
              </span>
            </div>

            <h1 className="text-3xl font-black leading-tight">
              イベント作成
            </h1>

            <p className="mt-3 text-sm font-semibold leading-6 text-blue-50">
              予測対象を作成し、公式AIの予測を生成します。
            </p>
          </div>
        </section>

        <section className="mb-5 rounded-[26px] bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-extrabold text-gray-700">
            管理メニュー
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/admin"
              className="rounded-2xl bg-blue-700 py-4 text-center text-sm font-extrabold text-white"
            >
              イベント作成
            </Link>

            <Link
              href="/admin/results"
              className="rounded-2xl bg-gray-100 py-4 text-center text-sm font-extrabold text-gray-700"
            >
              結果入力
            </Link>
          </div>

          <Link
            href="/ranking"
            className="mt-3 block rounded-2xl border border-gray-200 bg-white py-4 text-center text-sm font-extrabold text-gray-700"
          >
            ランキング確認
          </Link>
        </section>

        <section className="space-y-4 rounded-[26px] bg-white p-4 shadow-sm">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-gray-500">
              カテゴリ
            </span>

            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPredictions([]);
              }}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm font-bold outline-none"
            >
              {eventCategories.map((item, index) => (
                <option key={`${item.value}-${index}`} value={item.value}>
                  {item.emoji} {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold text-gray-500">
              イベント名
            </span>

            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setPredictions([]);
              }}
              placeholder="例：阪神 vs 巨人"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-gray-500">
                開催場所
              </span>

              <input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="例：甲子園"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-gray-500">
                開始日時
              </span>

              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-bold text-gray-500">
              候補リスト
            </span>

            <textarea
              value={candidateText}
              onChange={(e) => {
                setCandidateText(e.target.value);
                setPredictions([]);
              }}
              placeholder={`候補を1行ずつ入力してください\n例：\n阪神勝利\n巨人勝利\n引き分け`}
              rows={7}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm font-bold leading-6 outline-none focus:border-blue-400 focus:bg-white"
            />
          </label>

          <div className="rounded-2xl bg-blue-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-extrabold text-blue-700">
                現在のカテゴリ
              </div>

              <div className="text-sm font-extrabold text-blue-700">
                {getCategoryEmoji(category)} {getCategoryLabel(category)}
              </div>
            </div>

            <div className="text-xs font-bold leading-5 text-gray-500">
              候補数：{candidates.length}件 / AI予測：
              {predictions.length}件
            </div>
          </div>

          {candidates.length > 0 && (
            <div className="rounded-2xl bg-gray-50 p-4">
              <div className="mb-3 text-xs font-bold text-gray-500">
                入力された候補
              </div>

              <div className="flex flex-wrap gap-2">
                {candidates.map((candidate, index) => (
                  <span
                    key={`${candidate}-${index}`}
                    className="rounded-full bg-white px-3 py-2 text-xs font-extrabold text-gray-700"
                  >
                    {candidate}
                  </span>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className="mb-2 block text-xs font-bold text-gray-500">
              結果 winner
            </span>

            <select
              value={resultWinner}
              onChange={(e) => setResultWinner(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm font-bold outline-none"
            >
              <option value="">未入力</option>

              {candidates.map((candidate, index) => (
                <option key={`${candidate}-${index}`} value={candidate}>
                  {candidate}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={generatePredictions}
              disabled={!canCreate || generating || saving}
              className="rounded-2xl bg-gray-900 py-4 text-sm font-extrabold text-white disabled:bg-gray-300"
            >
              {generating ? "生成中..." : "AI予測生成"}
            </button>

            <button
              type="button"
              onClick={createEvent}
              disabled={!canCreate || generating || saving}
              className="rounded-2xl bg-blue-700 py-4 text-sm font-extrabold text-white disabled:bg-gray-300"
            >
              {saving ? "作成中..." : "イベント作成"}
            </button>
          </div>

          <button
            type="button"
            onClick={clearForm}
            className="w-full rounded-2xl bg-gray-100 py-4 text-sm font-extrabold text-gray-700"
          >
            入力をクリア
          </button>
        </section>

        {predictions.length > 0 && (
          <section className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold">生成済みAI予測</h2>

              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-500 shadow-sm">
                {predictions.length}件
              </span>
            </div>

            {predictions.map((prediction, index) => (
              <article
                key={`${prediction.ai}-${index}`}
                className="rounded-[24px] bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-extrabold">{prediction.ai}</h3>

                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    {prediction.confidence || "-"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-blue-50 p-3">
                    <div className="text-[11px] font-bold text-gray-500">
                      本命
                    </div>
                    <div className="mt-1 truncate text-sm font-extrabold text-blue-700">
                      {prediction.main}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-3">
                    <div className="text-[11px] font-bold text-gray-400">
                      対抗
                    </div>
                    <div className="mt-1 truncate text-sm font-extrabold">
                      {prediction.second || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-3">
                    <div className="text-[11px] font-bold text-gray-400">
                      3番手
                    </div>
                    <div className="mt-1 truncate text-sm font-extrabold">
                      {prediction.third || "-"}
                    </div>
                  </div>
                </div>

                <p className="mt-3 rounded-2xl bg-gray-50 p-3 text-sm font-semibold leading-6 text-gray-600">
                  {prediction.reason}
                </p>
              </article>
            ))}
          </section>
        )}
      </div>

      <BottomNav />
    </main>
  );
}