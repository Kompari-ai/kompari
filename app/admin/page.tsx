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

export default function AdminPage() {
  const router = useRouter();

  const [category, setCategory] = useState("horse_racing");
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [candidateText, setCandidateText] = useState("");
  const [resultWinner, setResultWinner] = useState("");
  const [saving, setSaving] = useState(false);

  const candidates = candidateText
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const canCreate = title.trim().length > 0 && candidates.length >= 2;

  const createEvent = async () => {
    if (!canCreate) {
      alert("イベント名と候補を2つ以上入力してください");
      return;
    }

    try {
      setSaving(true);

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
        // createEventは新規作成なので既存resultが無く、winnerがあれば常に初回確定。
        result: resultWinner
          ? { winner: resultWinner, settledAt: serverTimestamp() }
          : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      alert("イベントを作成しました。編集画面でAI予測を生成してください。");
      router.push(`/admin/edit/${eventId}`);
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
              予測対象を作成します。AI予測は編集画面で生成します。
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
              onChange={(e) => setCategory(e.target.value)}
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
              onChange={(e) => setTitle(e.target.value)}
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
              onChange={(e) => setCandidateText(e.target.value)}
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
              候補数：{candidates.length}件
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

          <button
            type="button"
            onClick={createEvent}
            disabled={!canCreate || saving}
            className="w-full rounded-2xl bg-blue-700 py-4 text-sm font-extrabold text-white disabled:bg-gray-300"
          >
            {saving ? "作成中..." : "イベント作成"}
          </button>

          <button
            type="button"
            onClick={clearForm}
            className="w-full rounded-2xl bg-gray-100 py-4 text-sm font-extrabold text-gray-700"
          >
            入力をクリア
          </button>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}