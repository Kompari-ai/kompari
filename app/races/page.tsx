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

type StatusFilter = "all" | "open" | "finished";

function getResultWinner(event: KompariEvent) {
  return event.result?.winner || event.resultWinner || "";
}

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

  return {
    name: sorted[0][0],
    count: sorted[0][1],
  };
}

function EventCard({ event }: { event: KompariEvent }) {
  const resultWinner = getResultWinner(event);
  const status = getStatus(event);
  const top = topPrediction(event);

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
              status === "finished"
                ? "bg-gray-100 text-gray-600"
                : "bg-green-50 text-green-700"
            }`}
          >
            {status === "finished" ? "結果済み" : "予測中"}
          </span>
        </div>

        <span className="text-lg font-extrabold text-gray-300">›</span>
      </div>

      <h2 className="text-lg font-extrabold leading-6">{event.title}</h2>

      <p className="mt-1 text-sm font-bold text-gray-500">
        {event.venue || "開催情報未入力"}
      </p>

      {event.startsIn && (
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
  const finishedCount = events.filter(
    (event) => getStatus(event) === "finished"
  ).length;

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
                EVENTS
              </span>

              <Link
                href="/admin"
                className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-blue-700"
              >
                作成
              </Link>
            </div>

            <h1 className="text-3xl font-extrabold">予測イベント</h1>

            <p className="mt-3 text-sm font-semibold leading-6 text-blue-50">
              競馬、スポーツ、株価、暗号資産などの予測をAIごとに比較します。
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">総数</div>
                <div className="mt-1 text-2xl font-extrabold text-blue-700">
                  {events.length}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">
                  予測中
                </div>
                <div className="mt-1 text-2xl font-extrabold text-gray-900">
                  {openCount}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[11px] font-bold text-gray-500">
                  結果済
                </div>
                <div className="mt-1 text-2xl font-extrabold text-gray-900">
                  {finishedCount}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-4 rounded-[24px] bg-white p-4 shadow-sm">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-gray-500">
              キーワード検索
            </span>

            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="イベント名・候補・AI名で検索"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white"
            />
          </label>

          <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
            {[
              { value: "all", label: "すべて" },
              { value: "open", label: "予測中" },
              { value: "finished", label: "結果済" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setStatusFilter(item.value as StatusFilter)}
                className={`py-3 text-sm font-extrabold ${
                  statusFilter === item.value
                    ? "bg-blue-700 text-white"
                    : "text-gray-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
                categoryFilter === "all"
                  ? "bg-blue-700 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              すべて
            </button>

            {eventCategories.map((category) => (
              <button
                key={category.value}
                type="button"
                onClick={() => setCategoryFilter(category.value)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
                  categoryFilter === category.value
                    ? "bg-blue-700 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {category.emoji} {category.shortLabel}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">イベント一覧</h2>

          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-500 shadow-sm">
            {filteredEvents.length}件表示
          </span>
        </section>

        <section className="space-y-3">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}

          {filteredEvents.length === 0 && (
            <div className="rounded-[24px] bg-white p-6 text-center shadow-sm">
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
                className="mt-4 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white"
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