"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import {
  eventCategories,
  getCategoryEmoji,
  getCategoryLabel,
} from "@/lib/categories";
import {
  getPredictionStatus,
  getResultWinner,
  normalizeRaceToEvent,
  type KompariEvent,
  type KompariPrediction,
  type LegacyRaceData,
} from "@/lib/events";

type MyAi = {
  id: string;
  name: string;
  style: string;
  strengthCategory: string;
  description: string;
  createdAt?: unknown;
};

type MyAiStats = {
  total: number;
  finished: number;
  hit: number;
  pending: number;
  hitRate: number;
};

function isThisMyAiPrediction(prediction: KompariPrediction, myAi: MyAi) {
  if (prediction.myAiId === myAi.id) return true;

  if (prediction.source === "user" && prediction.ai === myAi.name) {
    return true;
  }

  return prediction.ai === myAi.name;
}

function buildMyAiStats(events: KompariEvent[], myAi: MyAi): MyAiStats {
  const stats: MyAiStats = {
    total: 0,
    finished: 0,
    hit: 0,
    pending: 0,
    hitRate: 0,
  };

  events.forEach((event) => {
    const prediction = event.predictions.find((item) =>
      isThisMyAiPrediction(item, myAi)
    );

    if (!prediction) return;

    const resultWinner = getResultWinner(event);
    const status = getPredictionStatus(prediction, resultWinner);

    stats.total += 1;

    if (status === "pending") {
      stats.pending += 1;
    } else {
      stats.finished += 1;
      if (status === "hit") stats.hit += 1;
    }
  });

  stats.hitRate =
    stats.finished > 0
      ? Math.round((stats.hit / stats.finished) * 1000) / 10
      : 0;

  return stats;
}

function getInitial(name: string) {
  if (!name) return "AI";
  return name.slice(0, 2).toUpperCase();
}

export default function MyAiPage() {
  const [myAis, setMyAis] = useState<MyAi[]>([]);
  const [events, setEvents] = useState<KompariEvent[]>([]);

  const [name, setName] = useState("");
  const [style, setStyle] = useState("");
  const [strengthCategory, setStrengthCategory] = useState("horse_racing");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "myAis"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((document) => {
        return {
          id: document.id,
          ...document.data(),
        } as MyAi;
      });

      setMyAis(list);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "races"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((document) => {
        const data = {
          id: document.id,
          ...document.data(),
        } as LegacyRaceData;

        return normalizeRaceToEvent(data);
      });

      setEvents(list);
    });

    return () => unsubscribe();
  }, []);

  const totalStats = useMemo(() => {
    return myAis.reduce(
      (sum, myAi) => {
        const stats = buildMyAiStats(events, myAi);

        return {
          total: sum.total + stats.total,
          hit: sum.hit + stats.hit,
          finished: sum.finished + stats.finished,
          pending: sum.pending + stats.pending,
        };
      },
      {
        total: 0,
        hit: 0,
        finished: 0,
        pending: 0,
      }
    );
  }, [events, myAis]);

  const saveMyAi = async () => {
    if (!name.trim()) {
      alert("AI名を入力してください");
      return;
    }

    try {
      setSaving(true);

      await addDoc(collection(db, "myAis"), {
        name: name.trim(),
        style: style.trim() || "バランス型",
        strengthCategory,
        description:
          description.trim() ||
          "このAIは、ユーザーが設定した方針に基づいて予測するAIです。",
        createdAt: serverTimestamp(),
      });

      setName("");
      setStyle("");
      setStrengthCategory("horse_racing");
      setDescription("");

      alert("My AIを作成しました");
    } catch (error) {
      console.error(error);
      alert("My AIの作成に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const deleteMyAi = async (id: string) => {
    const ok = confirm(
      "このMy AIを削除しますか？\nすでに参加済みの予測データはイベント側に残ります。"
    );

    if (!ok) return;

    try {
      await deleteDoc(doc(db, "myAis", id));
    } catch (error) {
      console.error(error);
      alert("削除に失敗しました");
    }
  };

  return (
    <main className="min-h-screen bg-[#F2F4F8] text-[#0F172A]">
      <TopBar />

      <div className="mx-auto max-w-[430px] px-4 pb-28 pt-4">
        <section className="mb-5 overflow-hidden rounded-[18px] border border-[#E8ECF2] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div
            className="p-5 text-white"
            style={{
              background:
                "linear-gradient(150deg, #0B1F4B 0%, #13307A 60%, #1D5BFF 130%)",
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold tracking-[0.18em] text-white">
                USER AI LAB
              </span>

              <span className="text-xs font-bold text-blue-100">MY AI</span>
            </div>

            <h1 className="text-3xl font-extrabold">My AI</h1>

            <p className="mt-3 text-sm font-semibold leading-6 text-blue-50">
              自分だけの予測AIを作成し、公式AIと同じアリーナで競わせます。
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">
                  作成AI
                </div>

                <div className="mt-1 text-2xl font-extrabold text-blue-700 [font-variant-numeric:tabular-nums]">
                  {myAis.length}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">
                  予測数
                </div>

                <div className="mt-1 text-2xl font-extrabold text-gray-900 [font-variant-numeric:tabular-nums]">
                  {totalStats.total}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">的中</div>

                <div className="mt-1 text-2xl font-extrabold text-gray-900 [font-variant-numeric:tabular-nums]">
                  {totalStats.hit}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-gray-100 bg-white text-center">
            <div className="p-3">
              <div className="text-[11px] font-bold text-gray-400">結果済</div>
              <div className="mt-1 text-[15px] font-extrabold">
                {totalStats.finished}
              </div>
            </div>

            <div className="p-3">
              <div className="text-[11px] font-bold text-gray-400">予測中</div>
              <div className="mt-1 text-[15px] font-extrabold">
                {totalStats.pending}
              </div>
            </div>

            <div className="p-3">
              <div className="text-[11px] font-bold text-gray-400">収益化</div>
              <div className="mt-1 text-sm font-extrabold text-blue-700">
                候補
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h2 className="mb-4 text-[15px] font-extrabold">My AIを作成</h2>

          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="AI名 例：KingAI"
              className="w-full rounded-xl border border-gray-200 px-3 py-3"
            />

            <input
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="予測スタイル 例：堅実型 / 穴狙い型 / データ重視型"
              className="w-full rounded-xl border border-gray-200 px-3 py-3"
            />

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-gray-500">
                得意カテゴリ
              </span>

              <select
                value={strengthCategory}
                onChange={(e) => setStrengthCategory(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3"
              >
                {eventCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.emoji} {category.label}
                  </option>
                ))}
              </select>
            </label>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="このAIの特徴"
              className="min-h-28 w-full rounded-xl border border-gray-200 px-3 py-3"
            />

            <button
              type="button"
              onClick={saveMyAi}
              disabled={saving}
              className="w-full rounded-2xl bg-blue-700 py-4 font-bold text-white disabled:bg-gray-300"
            >
              {saving ? "保存中..." : "My AIを作成"}
            </button>
          </div>
        </section>

        <section className="mb-5 rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold">作成済みAI</h2>

            <Link
              href="/ranking"
              className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"
            >
              ランキングへ
            </Link>
          </div>

          <div className="space-y-3">
            {myAis.map((ai) => {
              const stats = buildMyAiStats(events, ai);

              return (
                <div
                  key={ai.id}
                  className="rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
                >
                  <div className="mb-4 flex items-start gap-3">
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold text-white"
                      style={{ backgroundColor: "#6366f1" }}
                    >
                      {getInitial(ai.name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-blue-700">
                        {getCategoryEmoji(ai.strengthCategory)}{" "}
                        {getCategoryLabel(ai.strengthCategory)}
                      </div>

                      <h3 className="mt-1 truncate text-[15px] font-extrabold">
                        {ai.name}
                      </h3>

                      <p className="mt-1 text-xs font-bold text-gray-500">
                        {ai.style}
                      </p>
                    </div>

                    {/* 将来対応: My AI削除 — Firestoreルール修正後に有効化 (see docs/AUDIT.md T-02)
                    <button
                      type="button"
                      onClick={() => deleteMyAi(ai.id)}
                      className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-400"
                    >
                      削除
                    </button>
                    */}
                  </div>

                  <p className="mb-4 text-sm leading-6 text-gray-600">
                    {ai.description}
                  </p>

                  <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl bg-white p-3">
                      <div className="text-[11px] font-bold text-gray-400">
                        的中率
                      </div>
                      <div className="mt-1 text-[15px] font-extrabold text-blue-700">
                        {stats.hitRate}%
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-3">
                      <div className="text-[11px] font-bold text-gray-400">
                        的中
                      </div>
                      <div className="mt-1 text-[15px] font-extrabold">
                        {stats.hit}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-3">
                      <div className="text-[11px] font-bold text-gray-400">
                        予測
                      </div>
                      <div className="mt-1 text-[15px] font-extrabold">
                        {stats.total}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      href={`/my-ai/${ai.id}`}
                      className="rounded-2xl bg-blue-700 py-3 text-center text-sm font-bold text-white"
                    >
                      詳細を見る
                    </Link>

                    <Link
                      href="/events"
                      className="rounded-2xl bg-white py-3 text-center text-sm font-bold text-gray-700"
                    >
                      参加させる
                    </Link>
                  </div>
                </div>
              );
            })}

            {myAis.length === 0 && (
              <div className="rounded-2xl bg-gray-50 p-5 text-center">
                <div className="text-sm font-bold text-gray-400">
                  まだMy AIがありません
                </div>

                <p className="mt-2 text-xs leading-5 text-gray-400">
                  上のフォームから、自分だけの予測AIを作成できます。
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h2 className="mb-3 text-[15px] font-extrabold">My AIの将来機能</h2>

          <div className="space-y-2 text-sm leading-6 text-gray-600">
            <p>・成績の良いAIを公開し、他ユーザーがフォローできる</p>
            <p>・人気AIを有料公開し、作成者に収益を還元する</p>
            <p>・AIごとにプロンプトや重視項目を細かく設定する</p>
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}