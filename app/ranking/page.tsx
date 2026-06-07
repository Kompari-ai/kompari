"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import {
  eventCategories,
  getCategoryEmoji,
  getCategoryLabel,
} from "@/lib/categories";
import {
  normalizeRaceToEvent,
  type KompariEvent,
  type LegacyRaceData,
} from "@/lib/events";

function getResultWinner(event: KompariEvent) {
  return event.result?.winner || event.resultWinner || "";
}

function isFinished(event: KompariEvent) {
  return !!getResultWinner(event);
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

function EventCard({
  event,
  compact = false,
}: {
  event: KompariEvent;
  compact?: boolean;
}) {
  const resultWinner = getResultWinner(event);
  const top = topPrediction(event);
  const finished = isFinished(event);

  return (
    <Link
      href={`/race/${event.id}`}
      className="block rounded-[26px] border border-gray-100 bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-extrabold text-blue-700">
            {getCategoryEmoji(event.category)} {getCategoryLabel(event.category)}
          </span>

          <span
            className={`rounded-full px-3 py-1 text-[11px] font-bold ${
              finished
                ? "bg-gray-100 text-gray-600"
                : "bg-green-50 text-green-700"
            }`}
          >
            {finished ? "結果済み" : "予測中"}
          </span>
        </div>

        <span className="text-lg font-extrabold text-gray-300">›</span>
      </div>

      <h2 className="text-lg font-extrabold leading-6">{event.title}</h2>

      <p className="mt-1 text-sm font-bold text-gray-500">
        {event.venue || "開催情報未入力"}
      </p>

      {!compact && event.startsIn && (
        <p className="mt-1 text-xs font-bold text-blue-700">
          {event.startsIn}
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-gray-50 p-3">
          <div className="text-[11px] font-bold text-gray-400">候補</div>
          <div className="mt-1 text-lg font-extrabold">
            {event.candidates.length}
          </div>
        </div>

        <div className="rounded-2xl bg-gray-50 p-3">
          <div className="text-[11px] font-bold text-gray-400">AI予測</div>
          <div className="mt-1 text-lg font-extrabold">
            {event.predictions.length}
          </div>
        </div>

        <div className="rounded-2xl bg-gray-50 p-3">
          <div className="text-[11px] font-bold text-gray-400">結果</div>
          <div className="mt-1 truncate text-sm font-extrabold">
            {resultWinner || "未入力"}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-blue-50 p-3">
        <div className="text-xs font-bold text-gray-500">
          AIコンセンサス本命
        </div>

        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="truncate font-extrabold text-blue-700">
            {top?.name || "まだAI予測がありません"}
          </div>

          <div className="shrink-0 text-xs font-bold text-blue-700">
            {top ? `${top.count}/${event.predictions.length}` : "-"}
          </div>
        </div>
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

  const openEvents = useMemo(
    () => events.filter((event) => !isFinished(event)),
    [events]
  );

  const finishedEvents = useMemo(
    () => events.filter((event) => isFinished(event)),
    [events]
  );

  const totalPredictions = useMemo(() => {
    return events.reduce((sum, event) => sum + event.predictions.length, 0);
  }, [events]);

  const featuredEvent = useMemo(() => {
    const withPrediction = openEvents.find(
      (event) => event.predictions.length > 0
    );

    return withPrediction || openEvents[0] || events[0] || null;
  }, [events, openEvents]);

  const pendingResults = useMemo(() => {
    return events.filter(
      (event) => event.predictions.length > 0 && !isFinished(event)
    );
  }, [events]);

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
            <div className="mb-5 flex items-center justify-between">
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold tracking-[0.18em] text-white">
                AI PREDICTION ARENA
              </span>

              <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-blue-700">
                MVP
              </span>
            </div>

            <h1 className="text-4xl font-black leading-tight tracking-tight">
              AI予測を
              <br />
              比較する。
            </h1>

            <p className="mt-4 text-sm font-semibold leading-6 text-blue-50">
              ChatGPT、Claude、Gemini、DeepSeek、My AIの予測を同じイベントで比較し、結果と人気をランキング化します。
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link
                href="/races"
                className="rounded-2xl bg-white py-4 text-center text-sm font-extrabold text-blue-700"
              >
                予測を見る
              </Link>

              <Link
                href="/my-ai"
                className="rounded-2xl bg-blue-950/35 py-4 text-center text-sm font-extrabold text-white ring-1 ring-white/25"
              >
                My AIを作る
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-4 divide-x divide-gray-100 bg-white text-center">
            <div className="p-3">
              <div className="text-[10px] font-bold text-gray-400">総数</div>
              <div className="mt-1 text-lg font-extrabold">{events.length}</div>
            </div>

            <div className="p-3">
              <div className="text-[10px] font-bold text-gray-400">予測中</div>
              <div className="mt-1 text-lg font-extrabold">
                {openEvents.length}
              </div>
            </div>

            <div className="p-3">
              <div className="text-[10px] font-bold text-gray-400">結果済</div>
              <div className="mt-1 text-lg font-extrabold">
                {finishedEvents.length}
              </div>
            </div>

            <div className="p-3">
              <div className="text-[10px] font-bold text-gray-400">AI予測</div>
              <div className="mt-1 text-lg font-extrabold">
                {totalPredictions}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[26px] bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">すぐ使う</h2>

            <span className="text-xs font-bold text-gray-400">SHORTCUTS</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/races"
              className="rounded-2xl bg-blue-700 p-4 text-white"
            >
              <div className="text-2xl">◇</div>
              <div className="mt-2 text-sm font-extrabold">予測イベント</div>
              <div className="mt-1 text-[11px] font-bold text-blue-100">
                AI予測を比較
              </div>
            </Link>

            <Link
              href="/ranking"
              className="rounded-2xl bg-gray-900 p-4 text-white"
            >
              <div className="text-2xl">♕</div>
              <div className="mt-2 text-sm font-extrabold">ランキング</div>
              <div className="mt-1 text-[11px] font-bold text-gray-300">
                的中率と人気
              </div>
            </Link>

            <Link href="/my-ai" className="rounded-2xl bg-gray-50 p-4">
              <div className="text-2xl">○</div>
              <div className="mt-2 text-sm font-extrabold">My AI</div>
              <div className="mt-1 text-[11px] font-bold text-gray-400">
                自分のAIを作る
              </div>
            </Link>

            <Link href="/notifications" className="rounded-2xl bg-gray-50 p-4">
              <div className="text-2xl">🔔</div>
              <div className="mt-2 text-sm font-extrabold">通知</div>
              <div className="mt-1 text-[11px] font-bold text-gray-400">
                未入力を確認
              </div>
            </Link>
          </div>
        </section>

        {featuredEvent && (
          <section className="mb-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">注目イベント</h2>

              <Link
                href="/races"
                className="text-xs font-extrabold text-blue-700"
              >
                すべて見る
              </Link>
            </div>

            <EventCard event={featuredEvent} />
          </section>
        )}

        <section className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">進行中イベント</h2>

            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-500 shadow-sm">
              {openEvents.length}件
            </span>
          </div>

          <div className="space-y-3">
            {openEvents.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}

            {openEvents.length === 0 && (
              <div className="rounded-[24px] bg-white p-6 text-center shadow-sm">
                <div className="text-3xl">✅</div>
                <div className="mt-3 text-sm font-bold text-gray-500">
                  現在、予測中イベントはありません
                </div>

                <Link
                  href="/admin"
                  className="mt-4 block rounded-2xl bg-blue-700 py-3 text-sm font-bold text-white"
                >
                  イベントを作成する
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="mb-5 rounded-[26px] bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">運用チェック</h2>

            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
              未入力 {pendingResults.length}
            </span>
          </div>

          <div className="space-y-3">
            <Link
              href="/admin/results"
              className="flex items-center justify-between rounded-2xl bg-gray-50 p-4"
            >
              <div>
                <div className="text-sm font-extrabold">結果入力</div>
                <div className="mt-1 text-xs font-bold text-gray-400">
                  予測済みで結果未入力のイベントを確認
                </div>
              </div>

              <div className="text-lg font-extrabold text-gray-300">›</div>
            </Link>

            <Link
              href="/admin"
              className="flex items-center justify-between rounded-2xl bg-gray-50 p-4"
            >
              <div>
                <div className="text-sm font-extrabold">イベント作成</div>
                <div className="mt-1 text-xs font-bold text-gray-400">
                  新しい予測対象を追加
                </div>
              </div>

              <div className="text-lg font-extrabold text-gray-300">›</div>
            </Link>
          </div>
        </section>

        <section className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">最近の結果</h2>

            <Link
              href="/ranking"
              className="text-xs font-extrabold text-blue-700"
            >
              ランキングへ
            </Link>
          </div>

          <div className="space-y-3">
            {finishedEvents.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}

            {finishedEvents.length === 0 && (
              <div className="rounded-[24px] bg-white p-6 text-center shadow-sm">
                <div className="text-3xl">🏁</div>
                <div className="mt-3 text-sm font-bold text-gray-500">
                  まだ結果済みイベントはありません
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[26px] bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">対応カテゴリ</h2>

            <span className="text-xs font-bold text-gray-400">
              {eventCategories.length}分野
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {eventCategories.map((category) => (
              <Link
                key={category.value}
                href={`/races`}
                className="rounded-2xl bg-gray-50 p-4"
              >
                <div className="text-2xl">{category.emoji}</div>
                <div className="mt-2 text-sm font-extrabold">
                  {category.shortLabel}
                </div>
                <div className="mt-1 text-[11px] font-bold text-gray-400">
                  AI予測比較
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}