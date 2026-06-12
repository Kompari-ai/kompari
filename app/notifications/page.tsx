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

function NotificationCard({ event }: { event: KompariEvent }) {
  const top = topPrediction(event);

  return (
    <div className="rounded-[24px] border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-extrabold text-blue-700">
            {getCategoryEmoji(event.category)} {getCategoryLabel(event.category)}
          </span>

          <span className="rounded-full bg-green-50 px-3 py-1 text-[11px] font-bold text-green-700">
            結果未入力
          </span>
        </div>
      </div>

      <h2 className="text-lg font-extrabold">{event.title}</h2>

      <p className="mt-1 text-sm font-bold text-gray-500">
        {event.venue || "開催情報未入力"}
      </p>

      <div className="mt-4 rounded-2xl bg-blue-50 p-3">
        <div className="text-xs font-bold text-gray-500">
          AIコンセンサス本命
        </div>

        <div className="mt-1 flex items-center justify-between">
          <div className="font-extrabold text-blue-700">
            {top?.name || "未生成"}
          </div>

          <div className="text-xs font-bold text-blue-700">
            {top ? `${top.count}/${event.predictions.length}` : "-"}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Link
          href={`/race/${event.id}`}
          className="block rounded-2xl bg-gray-100 py-3 text-center text-sm font-bold text-gray-700"
        >
          詳細を見る
        </Link>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
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

  const pendingResultEvents = useMemo(() => {
    return events.filter((event) => {
      const hasPredictions = event.predictions.length > 0;
      const hasResult = !!getResultWinner(event);

      return hasPredictions && !hasResult;
    });
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
        <section className="mb-5 overflow-hidden rounded-[30px] bg-white shadow-sm">
          <div
            className="p-5 text-white"
            style={{
              background:
                "linear-gradient(135deg, #2563eb 0%, #1d4ed8 45%, #172554 100%)",
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold tracking-[0.18em] text-white">
                NOTIFICATIONS
              </span>

              <span className="text-xl">🔔</span>
            </div>

            <h1 className="text-3xl font-extrabold">通知</h1>

            <p className="mt-3 text-sm font-semibold leading-6 text-blue-50">
              結果入力が必要なイベントや、現在の運用状況を確認できます。
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">
                  未入力
                </div>

                <div className="mt-1 text-2xl font-extrabold text-blue-700">
                  {pendingResultEvents.length}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">
                  結果済
                </div>

                <div className="mt-1 text-2xl font-extrabold text-gray-900">
                  {finishedEvents.length}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">
                  AI予測
                </div>

                <div className="mt-1 text-2xl font-extrabold text-gray-900">
                  {totalPredictions}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[24px] bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-extrabold">すぐ行う操作</h2>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/ranking"
              className="rounded-2xl bg-blue-700 py-4 text-center text-sm font-bold text-white"
            >
              ランキング確認
            </Link>

            <Link
              href="/races"
              className="rounded-2xl bg-gray-100 py-4 text-center text-sm font-bold text-gray-700"
            >
              予測を見る
            </Link>
          </div>
        </section>

        <section className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">結果未入力イベント</h2>

            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
              {pendingResultEvents.length}件
            </span>
          </div>

          <div className="space-y-3">
            {pendingResultEvents.map((event) => (
              <NotificationCard key={event.id} event={event} />
            ))}

            {pendingResultEvents.length === 0 && (
              <div className="rounded-[24px] bg-white p-6 text-center shadow-sm">
                <div className="text-3xl">✅</div>

                <div className="mt-3 text-sm font-bold text-gray-500">
                  結果未入力のイベントはありません
                </div>

                <p className="mt-2 text-xs leading-5 text-gray-400">
                  すべての結果入力が完了しています。
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}