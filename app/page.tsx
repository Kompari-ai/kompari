"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, collectionGroup, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { getCategoryEmoji, getCategoryLabel } from "@/lib/categories";
import { getAiColors, getAiInitial } from "@/lib/ai-colors";
import {
  formatStartsAt,
  getConsensusChip,
  getResultWinner,
  isPublicEvent,
  normalizeEventDocToEvent,
  type KompariEvent,
  type KompariEventDoc,
  type KompariPredictionDoc,
} from "@/lib/events";

function statusLabel(event: KompariEvent) {
  return getResultWinner(event) ? "結果入力済み" : "予測中";
}

function topPrediction(event: KompariEvent) {
  const counts: Record<string, number> = {};

  event.predictions.forEach((prediction) => {
    if (prediction.source === "user" || prediction.myAiId) return;
    if (!prediction.main) return;
    counts[prediction.main] = (counts[prediction.main] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) return null;

  return { name: sorted[0][0], count: sorted[0][1] };
}

function EventCard({ event }: { event: KompariEvent }) {
  const resultWinner = getResultWinner(event);
  const officialPreds = event.predictions.filter(
    (p) => p.source !== "user" && !p.myAiId
  );
  const top = topPrediction(event);
  const chip = getConsensusChip(event.predictions);

  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
    >
      {/* Top row */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-extrabold text-blue-700">
            {getCategoryEmoji(event.category)} {getCategoryLabel(event.category)}
          </span>

          {chip && (
            <span
              className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                chip.type === "unan"
                  ? "bg-green-50 text-green-700"
                  : chip.type === "lean"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {chip.label}
            </span>
          )}
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            resultWinner
              ? "bg-gray-100 text-gray-500"
              : "bg-green-50 text-green-700"
          }`}
        >
          {statusLabel(event)}
        </span>
      </div>

      <h2 className="text-[15px] font-extrabold leading-snug">{event.title}</h2>

      <p className="mt-1 text-[11px] text-[#94A3B8] font-semibold">
        {event.venue || "開催情報未入力"}
        {(event.startsAt || event.startsIn) && (
          <> ｜ {event.startsAt ? formatStartsAt(event.startsAt) : event.startsIn}</>
        )}
      </p>

      {/* AI consensus */}
      {top && (
        <div className="mt-3 rounded-[10px] bg-[#F8FAFC] border border-[#E8ECF2] p-3">
          <div className="mb-1 text-[10px] font-bold text-gray-500">
            AIコンセンサス本命
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="font-extrabold text-brand text-[13px]">{top.name}</div>
            <div className="text-[11px] font-bold text-brand">
              {top.count}/{officialPreds.length}
            </div>
          </div>
        </div>
      )}

      {/* Split meter */}
      {officialPreds.length > 0 && (
        <div className="mt-3">
          <div className="h-[8px] rounded-full overflow-hidden flex gap-[2px]">
            {officialPreds.map((p, i) => (
              <div
                key={`${p.ai}-${i}`}
                className="flex-1 h-full"
                style={{ background: getAiColors(p.ai).bg }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1.5">
            {officialPreds.slice(0, 4).map((p, i) => (
              <span
                key={`leg-${p.ai}-${i}`}
                className="text-[10px] text-gray-400 font-semibold flex items-center gap-1"
              >
                <span
                  className="w-1.5 h-1.5 rounded-[2px] inline-block shrink-0"
                  style={{ background: getAiColors(p.ai).bg }}
                />
                {p.ai}
              </span>
            ))}
            {officialPreds.length > 4 && (
              <span className="text-[10px] text-gray-400 font-semibold">
                +{officialPreds.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {resultWinner && (
        <div className="mt-3 rounded-[10px] bg-gray-50 px-3 py-2 text-[11px] font-bold text-gray-500">
          結果: <span className="text-gray-900 font-extrabold">{resultWinner}</span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {officialPreds.slice(0, 5).map((p, i) => (
            <div
              key={`av-${p.ai}-${i}`}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-extrabold text-white"
              style={{ background: getAiColors(p.ai).bg }}
            >
              {getAiInitial(p.ai)}
            </div>
          ))}
          {officialPreds.length === 0 && (
            <span className="text-[11px] font-bold text-gray-400">AI予測なし</span>
          )}
        </div>

        <span className="text-[11px] font-bold text-brand">
          詳細を見る ›
        </span>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [eventDocs, setEventDocs] = useState<KompariEventDoc[] | null>(null);
  const [predsMap, setPredsMap] = useState<Map<string, KompariPredictionDoc[]> | null>(null);

  const events = useMemo<KompariEvent[] | null>(() => {
    if (!eventDocs || !predsMap) return null;
    return eventDocs.map((doc) =>
      normalizeEventDocToEvent(doc, predsMap.get(doc.id) ?? [])
    );
  }, [eventDocs, predsMap]);

  useEffect(() => {
    // ① events 本体(createdAt降順)
    const eventsUnsub = onSnapshot(
      query(collection(db, "events"), orderBy("createdAt", "desc")),
      (snap) => {
        setEventDocs(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as KompariEventDoc))
        );
      }
    );

    // ② predictions を collectionGroup で全件(フィルタなし→インデックス不要)
    const predsUnsub = onSnapshot(
      collectionGroup(db, "predictions"),
      (snap) => {
        const map = new Map<string, KompariPredictionDoc[]>();
        for (const d of snap.docs) {
          const pred = d.data() as KompariPredictionDoc;
          const eid = pred.eventId;
          if (!eid) continue;
          if (!map.has(eid)) map.set(eid, []);
          map.get(eid)!.push(pred);
        }
        setPredsMap(map);
      }
    );

    return () => { eventsUnsub(); predsUnsub(); };
  }, []);

  // 公開ページはmanual-fixture(sample)eventを実績として見せない。
  const publicEvents = useMemo<KompariEvent[] | null>(() => {
    if (!events) return null;
    return events.filter(isPublicEvent);
  }, [events]);

  const featuredEvent = publicEvents ? (publicEvents[0] || null) : null;

  const pendingEvents = useMemo(() => {
    if (!publicEvents) return [];
    return publicEvents.filter((event) => !getResultWinner(event));
  }, [publicEvents]);

  const finishedEvents = useMemo(() => {
    if (!publicEvents) return [];
    return publicEvents.filter((event) => getResultWinner(event));
  }, [publicEvents]);

  const totalPredictions = useMemo(() => {
    if (!publicEvents) return 0;
    return publicEvents.reduce(
      (sum, event) =>
        sum +
        event.predictions.filter((p) => p.source !== "user" && !p.myAiId)
          .length,
      0
    );
  }, [publicEvents]);

  if (events === null) {
    return (
      <main className="min-h-screen bg-[#F2F4F8] text-[#0F172A]">
        <TopBar />
        <div className="mx-auto max-w-[430px] px-4 py-10 text-center text-sm font-bold text-gray-400">
          読み込み中...
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2F4F8] text-[#0F172A]">
      <TopBar />

      <div className="mx-auto max-w-[430px] px-4 pb-28 pt-4">
        {/* Hero */}
        <section className="mb-5 rounded-[18px] overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div
            className="p-5 text-white"
            style={{
              background:
                "linear-gradient(150deg, var(--color-brand) 0%, var(--color-brand-soft) 100%)",
            }}
          >
            <div className="mb-1 text-[10px] font-bold tracking-[0.22em] text-white/65">
              AI PREDICTION ARENA
            </div>

            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h1 className="text-[28px] font-extrabold leading-tight italic tracking-[-0.5px] text-white">
                  Kompari
                </h1>
                <p className="mt-1.5 text-[12px] leading-[1.6] text-white/70">
                  複数AIの競馬予測を比較し、結果と的中率まで確認できる予測メディアです。
                </p>
              </div>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-white/10 text-2xl">
                ⚡
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-[12px] bg-white/10 p-2.5">
                <div className="text-[10px] text-white/65">イベント</div>
                <div className="mt-0.5 text-xl font-extrabold [font-variant-numeric:tabular-nums]">{publicEvents?.length ?? 0}</div>
              </div>
              <div className="rounded-[12px] bg-white/10 p-2.5">
                <div className="text-[10px] text-white/65">予測中</div>
                <div className="mt-0.5 text-xl font-extrabold [font-variant-numeric:tabular-nums]">{pendingEvents.length}</div>
              </div>
              <div className="rounded-[12px] bg-white/10 p-2.5">
                <div className="text-[10px] text-white/65">AI予測</div>
                <div className="mt-0.5 text-xl font-extrabold [font-variant-numeric:tabular-nums]">{totalPredictions}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Featured event */}
        {featuredEvent && (
          <section className="mb-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15.5px] font-bold">注目イベント</h2>
              <Link href="/events" className="text-[12px] font-bold text-brand">
                すべて見る ›
              </Link>
            </div>
            <EventCard event={featuredEvent} />
          </section>
        )}

        {/* Quick links */}
        <section className="mb-5 rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h2 className="mb-3 text-[15.5px] font-bold">すぐ使う</h2>

          <div className="grid grid-cols-3 gap-2">
            <Link
              href="/events"
              className="rounded-[12px] bg-brand py-3.5 text-center text-[13px] font-bold text-white"
            >
              予測を見る
            </Link>
            <Link
              href="/ranking"
              className="rounded-[12px] bg-gray-100 py-3.5 text-center text-[13px] font-bold text-gray-700"
            >
              ランキング
            </Link>
            <Link
              href="/notifications"
              className="rounded-[12px] bg-gray-100 py-3.5 text-center text-[13px] font-bold text-gray-700"
            >
              通知
            </Link>
          </div>
        </section>

        {/* Pending events */}
        <section className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15.5px] font-bold">予測中イベント</h2>
            <span className="text-[12px] font-bold text-gray-400">{pendingEvents.length}件</span>
          </div>

          <div className="space-y-3">
            {pendingEvents.slice(0, 5).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}

            {pendingEvents.length === 0 && (
              <div className="rounded-[18px] border border-[#E8ECF2] bg-white p-5 text-center text-sm font-bold text-gray-400 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                予測中イベントはありません
              </div>
            )}
          </div>
        </section>

        {/* Finished events */}
        <section className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[15.5px] font-bold">結果入力済み</h2>
              <span className="text-[12px] font-bold text-gray-400">{finishedEvents.length}件</span>
            </div>
            <Link href="/results" className="text-[12px] font-bold text-brand">
              すべての結果を見る ›
            </Link>
          </div>

          <div className="space-y-3">
            {finishedEvents.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}

            {finishedEvents.length === 0 && (
              <div className="rounded-[18px] border border-[#E8ECF2] bg-white p-5 text-center text-sm font-bold text-gray-400 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                結果入力済みイベントはありません
              </div>
            )}
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
