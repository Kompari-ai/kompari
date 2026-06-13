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
import { getAiColors, getAiInitial } from "@/lib/ai-colors";
import {
  formatStartsAt,
  getConsensusChip,
  getResultWinner,
  normalizeRaceToEvent,
  type KompariEvent,
  type LegacyRaceData,
} from "@/lib/events";

type StatusFilter = "all" | "open" | "finished";

function getStatus(event: KompariEvent) {
  return getResultWinner(event) ? "finished" : "open";
}

function topPrediction(event: KompariEvent) {
  const counts: Record<string, number> = {};

  event.predictions.forEach((prediction) => {
    if (!prediction.main) return;
    counts[prediction.main] = (counts[prediction.main] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) return null;

  return { name: sorted[0][0], count: sorted[0][1] };
}

function EventCard({ event }: { event: KompariEvent }) {
  const resultWinner = getResultWinner(event);
  const status = getStatus(event);
  const top = topPrediction(event);
  const chip = getConsensusChip(event.predictions);

  return (
    <Link
      href={`/race/${event.id}`}
      className="block rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-sm"
    >
      {/* Top row */}
      <div className="mb-2 flex items-center justify-between gap-2">
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
          className={`shrink-0 text-[19px] font-extrabold text-[#E8ECF2]`}
        >
          ›
        </span>
      </div>

      <h2 className="text-[15px] font-extrabold leading-snug">{event.title}</h2>

      <p className="mt-0.5 text-[12px] font-semibold text-[#64748B]">
        {event.venue || "開催情報未入力"}
      </p>

      {(event.startsAt || event.startsIn) && (
        <p className="mt-0.5 text-[11px] font-bold text-blue-700">
          {event.startsAt ? formatStartsAt(event.startsAt) : event.startsIn}
        </p>
      )}

      {/* Stats row */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-[10px] bg-gray-50 p-2.5">
          <div className="text-[10px] font-bold text-gray-400">候補</div>
          <div className="mt-0.5 text-base font-extrabold">
            {event.candidates.length}
          </div>
        </div>
        <div className="rounded-[10px] bg-gray-50 p-2.5">
          <div className="text-[10px] font-bold text-gray-400">AI予測</div>
          <div className="mt-0.5 text-base font-extrabold">
            {event.predictions.length}
          </div>
        </div>
        <div className="rounded-[10px] bg-gray-50 p-2.5">
          <div className="text-[10px] font-bold text-gray-400">結果</div>
          <div className="mt-0.5 truncate text-sm font-extrabold">
            {resultWinner || "未入力"}
          </div>
        </div>
      </div>

      {/* AI consensus */}
      {top && (
        <div className="mt-3 rounded-[10px] bg-[#F8FAFC] border border-[#E8ECF2] p-2.5">
          <div className="text-[10px] font-bold text-gray-500">AIコンセンサス本命</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="truncate font-extrabold text-blue-700 text-[13px]">{top.name}</div>
            <div className="shrink-0 text-[11px] font-bold text-blue-700">
              {top.count}/{event.predictions.length}
            </div>
          </div>
        </div>
      )}

      {/* Split meter */}
      {event.predictions.length > 0 && (
        <div className="mt-3">
          <div className="h-[7px] rounded-full overflow-hidden flex gap-[2px]">
            {event.predictions.map((p, i) => (
              <div
                key={`${p.ai}-${i}`}
                className="flex-1 h-full"
                style={{ background: getAiColors(p.ai).bg }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1.5">
            {event.predictions.slice(0, 4).map((p, i) => (
              <span
                key={`leg-${p.ai}-${i}`}
                className="text-[10px] text-gray-400 font-semibold flex items-center gap-1"
              >
                <span
                  className="w-1.5 h-1.5 rounded-[2px] inline-block shrink-0"
                  style={{ background: getAiColors(p.ai).bg }}
                />
                {getAiInitial(p.ai)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Status badge */}
      <div className="mt-3 flex items-center justify-between">
        <span
          className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
            status === "finished"
              ? "bg-gray-100 text-gray-500"
              : "bg-green-50 text-green-700"
          }`}
        >
          {status === "finished" ? "結果済み" : "予測中"}
        </span>

        <div className="flex -space-x-1.5">
          {event.predictions.slice(0, 4).map((p, i) => (
            <div
              key={`av-${p.ai}-${i}`}
              className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[8px] font-extrabold text-white"
              style={{ background: getAiColors(p.ai).bg }}
            >
              {getAiInitial(p.ai)}
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

export default function RacesPage() {
  const [events, setEvents] = useState<KompariEvent[]>([]);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

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

  const filteredEvents = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return events.filter((event) => {
      const resultWinner = getResultWinner(event);

      if (statusFilter !== "all" && getStatus(event) !== statusFilter) {
        return false;
      }

      if (categoryFilter !== "all" && event.category !== categoryFilter) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      const targetText = [
        event.title,
        event.venue,
        event.startsIn,
        resultWinner,
        ...event.candidates,
        ...event.predictions.map((prediction) => prediction.ai),
        ...event.predictions.map((prediction) => prediction.main),
      ]
        .join(" ")
        .toLowerCase();

      return targetText.includes(normalizedKeyword);
    });
  }, [categoryFilter, events, keyword, statusFilter]);

  const openCount = events.filter((event) => getStatus(event) === "open").length;
  const finishedCount = events.filter((event) => getStatus(event) === "finished").length;

  return (
    <main className="min-h-screen bg-[#F2F4F8] text-[#0F172A]">
      <TopBar />

      <div className="mx-auto max-w-[430px] px-4 pb-28 pt-4">
        {/* Header */}
        <section className="mb-4 overflow-hidden rounded-[18px] border border-[#E8ECF2] bg-white shadow-sm">
          <div
            className="p-5 text-white"
            style={{
              background:
                "linear-gradient(150deg, #0B1F4B 0%, #13307A 60%, #1D5BFF 130%)",
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold tracking-[0.18em] text-white">
                EVENTS
              </span>
            </div>

            <h1 className="text-[24px] font-extrabold">予測イベント</h1>

            <p className="mt-2 text-[12px] font-semibold leading-[1.6] text-white/70">
              競馬、スポーツ、株価、暗号資産などの予測をAIごとに比較します。
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-[12px] bg-white p-2.5">
                <div className="text-[10px] font-bold text-gray-500">総数</div>
                <div className="mt-0.5 text-xl font-extrabold text-blue-700">
                  {events.length}
                </div>
              </div>
              <div className="rounded-[12px] bg-white p-2.5">
                <div className="text-[10px] font-bold text-gray-500">予測中</div>
                <div className="mt-0.5 text-xl font-extrabold text-gray-900">
                  {openCount}
                </div>
              </div>
              <div className="rounded-[12px] bg-white p-2.5">
                <div className="text-[10px] font-bold text-gray-500">結果済</div>
                <div className="mt-0.5 text-xl font-extrabold text-gray-900">
                  {finishedCount}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="mb-4 rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-sm">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold text-gray-500">
              キーワード検索
            </span>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="イベント名・候補・AI名で検索"
              className="w-full rounded-[12px] border border-[#E8ECF2] bg-gray-50 px-4 py-2.5 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white"
            />
          </label>

          <div className="mt-3 flex bg-[#E7EBF2] rounded-[12px] p-[3px]">
            {[
              { value: "all", label: "すべて" },
              { value: "open", label: "予測中" },
              { value: "finished", label: "結果済" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setStatusFilter(item.value as StatusFilter)}
                className={`flex-1 py-2 text-[13px] font-bold rounded-[10px] transition-colors ${
                  statusFilter === item.value
                    ? "bg-white text-[#0F172A] shadow-sm"
                    : "text-[#64748B]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold border ${
                categoryFilter === "all"
                  ? "bg-[#0F172A] text-white border-[#0F172A]"
                  : "bg-white text-[#64748B] border-[#E8ECF2]"
              }`}
            >
              すべて
            </button>

            {eventCategories.map((category) => (
              <button
                key={category.value}
                type="button"
                onClick={() => setCategoryFilter(category.value)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold border ${
                  categoryFilter === category.value
                    ? "bg-[#0F172A] text-white border-[#0F172A]"
                    : "bg-white text-[#64748B] border-[#E8ECF2]"
                }`}
              >
                {category.emoji} {category.shortLabel}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-3 flex items-center justify-between">
          <h2 className="text-[15.5px] font-bold">イベント一覧</h2>
          <span className="rounded-full border border-[#E8ECF2] bg-white px-3 py-1 text-[11px] font-bold text-gray-500 shadow-sm">
            {filteredEvents.length}件
          </span>
        </section>

        <section className="space-y-3">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}

          {filteredEvents.length === 0 && (
            <div className="rounded-[18px] border border-[#E8ECF2] bg-white p-6 text-center shadow-sm">
              <div className="text-3xl">🔍</div>
              <div className="mt-3 text-sm font-bold text-gray-500">
                条件に合うイベントがありません
              </div>
              <button
                type="button"
                onClick={() => {
                  setKeyword("");
                  setStatusFilter("all");
                  setCategoryFilter("all");
                }}
                className="mt-4 rounded-[12px] bg-blue-700 px-5 py-3 text-sm font-bold text-white"
              >
                条件をリセット
              </button>
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
