"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { getCategoryEmoji, getCategoryLabel } from "@/lib/categories";
import {
  normalizeRaceToEvent,
  type KompariEvent,
  type LegacyRaceData,
} from "@/lib/events";

function getResultWinner(event: KompariEvent) {
  return event.result?.winner || event.resultWinner || "";
}

function statusLabel(event: KompariEvent) {
  return getResultWinner(event) ? "結果入力済み" : "予測中";
}

function statusClass(event: KompariEvent) {
  return getResultWinner(event)
    ? "bg-blue-50 text-blue-700"
    : "bg-green-50 text-green-700";
}

function topPrediction(event: KompariEvent) {
  const counts: Record<string, number> = {};

  event.predictions.forEach((prediction) => {
    if (!prediction.main) return;
    counts[prediction.main] = (counts[prediction.main] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) return null;

  return {
    name: sorted[0][0],
    count: sorted[0][1],
  };
}

function aiInitial(ai: string) {
  if (ai === "ChatGPT") return "C";
  if (ai === "Claude") return "Cl";
  if (ai === "Gemini") return "G";
  if (ai === "DeepSeek") return "D";
  return ai.slice(0, 1);
}

function EventCard({ event }: { event: KompariEvent }) {
  const resultWinner = getResultWinner(event);
  const top = topPrediction(event);

  return (
    <Link
      href={`/race/${event.id}`}
      className="block rounded-[24px] border border-gray-100 bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-extrabold text-blue-700">
            {getCategoryEmoji(event.category)} {getCategoryLabel(event.category)}
          </span>

          <span
            className={`rounded-full px-3 py-1 text-[11px] font-bold ${statusClass(
              event
            )}`}
          >
            {statusLabel(event)}
          </span>
        </div>

        <span className="text-xs font-bold text-gray-400">詳細 ›</span>
      </div>

      <h2 className="text-lg font-extrabold leading-snug">{event.title}</h2>

      <p className="mt-1 text-sm font-semibold text-gray-500">
        {event.venue || "開催情報未入力"}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-gray-50 p-3">
          <div className="text-[11px] font-bold text-gray-400">候補</div>
          <div className="mt-1 text-lg font-extrabold">
            {event.candidates.length}
          </div>
        </div>

        <div className="rounded-2xl bg-gray-50 p-3">
          <div className="text-[11px] font-bold text-gray-400">AI</div>
          <div className="mt-1 text-lg font-extrabold">
            {event.predictions.length}
          </div>
        </div>

        <div className="rounded-2xl bg-gray-50 p-3">
          <div className="text-[11px] font-bold text-gray-400">締切</div>
          <div className="mt-1 truncate text-sm font-extrabold">
            {event.startsIn || "未設定"}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-blue-50 p-3">
        <div className="mb-1 text-xs font-bold text-gray-500">
          AIコンセンサス本命
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="font-extrabold text-blue-700">
            {top?.name || "未生成"}
          </div>

          <div className="text-xs font-bold text-blue-700">
            {top ? `${top.count}/${event.predictions.length}` : "-"}
          </div>
        </div>
      </div>

      {resultWinner && (
        <div className="mt-3 rounded-2xl bg-gray-50 p-3">
          <div className="text-xs font-bold text-gray-400">結果</div>
          <div className="mt-1 font-extrabold">{resultWinner}</div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex -space-x-2">
          {event.predictions.slice(0, 5).map((prediction, index) => (
            <div
              key={`${prediction.ai}-${index}`}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[10px] font-extrabold text-gray-700"
            >
              {aiInitial(prediction.ai)}
            </div>
          ))}

          {event.predictions.length === 0 && (
            <div className="text-xs font-bold text-gray-400">
              AI予測なし
            </div>
          )}
        </div>

        <span className="text-xs font-bold text-gray-400">
          {event.predictions.length} AI参加
        </span>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [events, setEvents] = useState<KompariEvent[]>([]);

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

  const featuredEvent = events[0] || null;

  const pendingEvents = useMemo(() => {
    return events.filter((event) => !getResultWinner(event));
  }, [events]);

  const finishedEvents = useMemo(() => {
    return events.filter((event) => getResultWinner(event));
  }, [events]);

  const totalPredictions = useMemo(() => {
    return events.reduce((sum, event) => sum + event.predictions.length, 0);
  }, [events]);

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#111827]">
      <TopBar />

      <div className="mx-auto max-w-[430px] px-4 pb-28 pt-4">
        <section className="mb-5 rounded-[28px] bg-gradient-to-br from-blue-700 via-blue-800 to-blue-950 p-5 text-white shadow-xl">
          <div className="mb-3 text-[11px] font-bold tracking-[0.22em] text-white/70">
            AI PREDICTION ARENA
          </div>

          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold leading-tight">
                Kompari
              </h1>

              <p className="mt-2 text-sm leading-6 text-white/75">
                競馬・スポーツ・金融・選挙などの予測を、公式AIとMy AIで比較するプラットフォームです。
              </p>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white/10 text-3xl">
              ⚡
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-white/10 p-3">
              <div className="text-xs text-white/65">イベント</div>
              <div className="mt-1 text-2xl font-extrabold">
                {events.length}
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 p-3">
              <div className="text-xs text-white/65">予測中</div>
              <div className="mt-1 text-2xl font-extrabold">
                {pendingEvents.length}
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 p-3">
              <div className="text-xs text-white/65">AI予測</div>
              <div className="mt-1 text-2xl font-extrabold">
                {totalPredictions}
              </div>
            </div>
          </div>
        </section>

        {featuredEvent && (
          <section className="mb-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">注目イベント</h2>

              <Link
                href="/races"
                className="text-xs font-bold text-blue-700"
              >
                すべて見る
              </Link>
            </div>

            <EventCard event={featuredEvent} />
          </section>
        )}

        <section className="mb-5 rounded-[24px] bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-extrabold">すぐ使う</h2>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/races"
              className="rounded-2xl bg-blue-700 py-4 text-center text-sm font-bold text-white"
            >
              予測を見る
            </Link>

            <Link
              href="/ranking"
              className="rounded-2xl bg-gray-100 py-4 text-center text-sm font-bold text-gray-700"
            >
              ランキング
            </Link>

            <Link
              href="/my-ai"
              className="rounded-2xl bg-gray-100 py-4 text-center text-sm font-bold text-gray-700"
            >
              My AI
            </Link>

            <Link
              href="/admin/results"
              className="rounded-2xl bg-gray-100 py-4 text-center text-sm font-bold text-gray-700"
            >
              結果入力
            </Link>
          </div>
        </section>

        <section className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">予測中イベント</h2>

            <span className="text-xs font-bold text-gray-400">
              {pendingEvents.length}件
            </span>
          </div>

          <div className="space-y-3">
            {pendingEvents.slice(0, 5).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}

            {pendingEvents.length === 0 && (
              <div className="rounded-[22px] bg-white p-5 text-center text-sm font-bold text-gray-400 shadow-sm">
                予測中イベントはありません
              </div>
            )}
          </div>
        </section>

        <section className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">結果入力済み</h2>

            <span className="text-xs font-bold text-gray-400">
              {finishedEvents.length}件
            </span>
          </div>

          <div className="space-y-3">
            {finishedEvents.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}

            {finishedEvents.length === 0 && (
              <div className="rounded-[22px] bg-white p-5 text-center text-sm font-bold text-gray-400 shadow-sm">
                結果入力済みイベントはありません
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-4">
          <div className="mb-3 text-center text-sm font-extrabold text-gray-600">
            管理メニュー
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/admin"
              className="rounded-2xl bg-blue-700 py-3 text-center text-sm font-bold text-white"
            >
              イベント作成
            </Link>

            <Link
              href="/admin/results"
              className="rounded-2xl bg-gray-100 py-3 text-center text-sm font-bold text-gray-700"
            >
              結果入力
            </Link>
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}