"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  collectionGroup,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { getCategoryEmoji, getCategoryLabel } from "@/lib/categories";
import {
  getResultWinner,
  normalizeEventDocToEvent,
  type KompariEvent,
  type KompariEventDoc,
  type KompariPredictionDoc,
} from "@/lib/events";

function NotificationCard({ event }: { event: KompariEvent }) {
  const officialPreds = event.predictions.filter(
    (p) => p.source !== "user" && !p.myAiId
  );

  const counts: Record<string, number> = {};
  officialPreds.forEach((p) => {
    if (!p.main) return;
    counts[p.main] = (counts[p.main] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top =
    sorted.length > 0 ? { name: sorted[0][0], count: sorted[0][1] } : null;

  return (
    <div className="rounded-[24px] border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-extrabold text-blue-700">
            {getCategoryEmoji(event.category)} {getCategoryLabel(event.category)}
          </span>

          <span className="rounded-full bg-green-50 px-3 py-1 text-[11px] font-bold text-green-700">
            結果待ち
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
            {top ? `${top.count}/${officialPreds.length}` : "-"}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Link
          href={`/events/${event.id}`}
          className="block rounded-2xl bg-gray-100 py-3 text-center text-sm font-bold text-gray-700"
        >
          詳細を見る
        </Link>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [eventDocs, setEventDocs] = useState<KompariEventDoc[] | null>(null);
  const [predsMap, setPredsMap] = useState<Map<
    string,
    KompariPredictionDoc[]
  > | null>(null);

  const events = useMemo<KompariEvent[] | null>(() => {
    if (!eventDocs || !predsMap) return null;
    return eventDocs.map((doc) =>
      normalizeEventDocToEvent(doc, predsMap.get(doc.id) ?? [])
    );
  }, [eventDocs, predsMap]);

  useEffect(() => {
    const eventsUnsub = onSnapshot(
      query(collection(db, "events"), orderBy("createdAt", "desc")),
      (snap) => {
        setEventDocs(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as KompariEventDoc))
        );
      }
    );

    const predsUnsub = onSnapshot(
      collectionGroup(db, "predictions"),
      (snap) => {
        const map = new Map<string, KompariPredictionDoc[]>();
        for (const d of snap.docs) {
          const pred = d.data() as KompariPredictionDoc;
          const eid = pred.eventId || d.ref.parent.parent?.id;
          if (!eid) continue;
          if (!map.has(eid)) map.set(eid, []);
          map.get(eid)!.push(pred);
        }
        setPredsMap(map);
      }
    );

    return () => {
      eventsUnsub();
      predsUnsub();
    };
  }, []);

  const pendingResultEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((event) => {
      const officialPreds = event.predictions.filter(
        (p) => p.source !== "user" && !p.myAiId
      );
      return officialPreds.length > 0 && !getResultWinner(event);
    });
  }, [events]);

  const finishedEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((event) => {
      const officialPreds = event.predictions.filter(
        (p) => p.source !== "user" && !p.myAiId
      );
      return officialPreds.length > 0 && !!getResultWinner(event);
    });
  }, [events]);

  const totalPredictions = useMemo(() => {
    if (!events) return 0;
    return events.reduce(
      (sum, event) =>
        sum +
        event.predictions.filter((p) => p.source !== "user" && !p.myAiId)
          .length,
      0
    );
  }, [events]);

  if (events === null) {
    return (
      <main className="min-h-screen bg-[#f5f5f7] text-[#111827]">
        <TopBar />
        <div className="mx-auto max-w-[430px] px-4 py-10 text-center text-sm font-bold text-gray-400">
          読み込み中...
        </div>
        <BottomNav />
      </main>
    );
  }

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

            <h1 className="text-3xl font-extrabold">結果待ちイベント</h1>

            <p className="mt-3 text-sm font-semibold leading-6 text-blue-50">
              AI予測が入っていて、まだ結果が出ていないイベントをまとめています。
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">
                  結果待ち
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
          <h2 className="mb-4 text-lg font-extrabold">ページへ移動</h2>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/ranking"
              className="rounded-2xl bg-blue-700 py-4 text-center text-sm font-bold text-white"
            >
              ランキングを見る
            </Link>

            <Link
              href="/events"
              className="rounded-2xl bg-gray-100 py-4 text-center text-sm font-bold text-gray-700"
            >
              予測を見る
            </Link>
          </div>
        </section>

        <section className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">結果待ちイベント</h2>

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
                  結果待ちのイベントはありません
                </div>

                <p className="mt-2 text-xs leading-5 text-gray-400">
                  すべてのイベントの結果が確定しています。
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
