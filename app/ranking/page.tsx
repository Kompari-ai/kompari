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
  type EventCategory,
} from "@/lib/categories";
import {
  normalizeRaceToEvent,
  type KompariEvent,
  type KompariPrediction,
  type LegacyRaceData,
} from "@/lib/events";

type CategoryFilter = "all" | EventCategory;
type SourceFilter = "all" | "official" | "user";

type RankingHistory = {
  eventId: string;
  title: string;
  category: EventCategory;
  winner: string;
  pick: string;
  hit: boolean;
};

type RankingRow = {
  key: string;
  ai: string;
  source: "official" | "user";
  myAiId?: string;
  total: number;
  hits: number;
  accuracy: number;
  history: RankingHistory[];
};

function getResultWinner(event: KompariEvent) {
  return (event.result?.winner || event.resultWinner || "").trim();
}

function getPredictionSource(prediction: KompariPrediction) {
  return prediction.source === "user" ? "user" : "official";
}

function getPredictionKey(prediction: KompariPrediction) {
  const source = getPredictionSource(prediction);
  return `${source}:${prediction.myAiId || prediction.ai || "unknown"}`;
}

function buildRankings(events: KompariEvent[]) {
  const map = new Map<string, RankingRow>();

  events.forEach((event) => {
    const winner = getResultWinner(event);
    if (!winner) return;

    event.predictions.forEach((prediction) => {
      const pick = prediction.main?.trim();
      if (!pick) return;

      const source = getPredictionSource(prediction);
      const key = getPredictionKey(prediction);

      const current =
        map.get(key) ||
        ({
          key,
          ai: prediction.ai || "Unknown AI",
          source,
          myAiId: prediction.myAiId,
          total: 0,
          hits: 0,
          accuracy: 0,
          history: [],
        } satisfies RankingRow);

      const hit = pick === winner;

      current.total += 1;
      if (hit) current.hits += 1;

      current.history.push({
        eventId: event.id,
        title: event.title,
        category: event.category,
        winner,
        pick,
        hit,
      });

      map.set(key, current);
    });
  });

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      accuracy: row.total > 0 ? row.hits / row.total : 0,
    }))
    .sort((a, b) => {
      if (b.hits !== a.hits) return b.hits - a.hits;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      if (b.total !== a.total) return b.total - a.total;
      return a.ai.localeCompare(b.ai);
    });
}

function formatAccuracy(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function sourceLabel(source: RankingRow["source"]) {
  return source === "user" ? "My AI" : "Official AI";
}

function sourceClass(source: RankingRow["source"]) {
  return source === "user"
    ? "bg-purple-50 text-purple-700"
    : "bg-blue-50 text-blue-700";
}

function rankBadge(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `${index + 1}`;
}

export default function RankingPage() {
  const [events, setEvents] = useState<KompariEvent[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  useEffect(() => {
    const q = query(collection(db, "races"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((document) => {
          const data = {
            id: document.id,
            ...document.data(),
          } as LegacyRaceData;

          return normalizeRaceToEvent(data);
        });

        setEvents(list);
      },
      (error) => {
        console.error(error);
      }
    );

    return () => unsubscribe();
  }, []);

  const finishedEvents = useMemo(() => {
    return events.filter((event) => !!getResultWinner(event));
  }, [events]);

  const targetEvents = useMemo(() => {
    return finishedEvents.filter((event) => {
      if (categoryFilter === "all") return true;
      return event.category === categoryFilter;
    });
  }, [finishedEvents, categoryFilter]);

  const rankings = useMemo(() => {
    return buildRankings(targetEvents).filter((row) => {
      if (sourceFilter === "all") return true;
      return row.source === sourceFilter;
    });
  }, [targetEvents, sourceFilter]);

  const totalPredictions = useMemo(() => {
    return rankings.reduce((sum, row) => sum + row.total, 0);
  }, [rankings]);

  const totalHits = useMemo(() => {
    return rankings.reduce((sum, row) => sum + row.hits, 0);
  }, [rankings]);

  const overallAccuracy = totalPredictions
    ? totalHits / totalPredictions
    : 0;

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#111827]">
      <TopBar />

      <div className="mx-auto max-w-[430px] px-4 pb-28 pt-4">
        <section className="mb-5 overflow-hidden rounded-[32px] bg-white shadow-sm">
          <div
            className="p-5 text-white"
            style={{
              background:
                "linear-gradient(135deg, #111827 0%, #1d4ed8 55%, #2563eb 100%)",
            }}
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold tracking-[0.18em] text-white">
                AI RANKING
              </span>

              <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-blue-700">
                1着的中
              </span>
            </div>

            <h1 className="text-4xl font-black leading-tight tracking-tight">
              AI的中
              <br />
              ランキング
            </h1>

            <p className="mt-4 text-sm font-semibold leading-6 text-blue-50">
              結果入力済みイベントをもとに、各AIの本命予測が実際の勝者と一致したかを集計します。
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white/10 p-3">
                <div className="text-xs text-white/65">対象</div>
                <div className="mt-1 text-2xl font-extrabold">
                  {targetEvents.length}
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 p-3">
                <div className="text-xs text-white/65">的中</div>
                <div className="mt-1 text-2xl font-extrabold">
                  {totalHits}
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 p-3">
                <div className="text-xs text-white/65">的中率</div>
                <div className="mt-1 text-2xl font-extrabold">
                  {formatAccuracy(overallAccuracy)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[26px] bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-extrabold text-gray-700">
            フィルター
          </div>

          <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => setSourceFilter("all")}
              className={`py-4 text-sm font-extrabold ${
                sourceFilter === "all"
                  ? "bg-blue-700 text-white"
                  : "text-gray-600"
              }`}
            >
              すべて
            </button>

            <button
              type="button"
              onClick={() => setSourceFilter("official")}
              className={`py-4 text-sm font-extrabold ${
                sourceFilter === "official"
                  ? "bg-blue-700 text-white"
                  : "text-gray-600"
              }`}
            >
              公式AI
            </button>

            <button
              type="button"
              onClick={() => setSourceFilter("user")}
              className={`py-4 text-sm font-extrabold ${
                sourceFilter === "user"
                  ? "bg-blue-700 text-white"
                  : "text-gray-600"
              }`}
            >
              My AI
            </button>
          </div>

          <div className="mt-4 overflow-x-auto pb-1">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-extrabold ${
                  categoryFilter === "all"
                    ? "bg-blue-700 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                全カテゴリ
              </button>

              {eventCategories.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => setCategoryFilter(category.value)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-extrabold ${
                    categoryFilter === category.value
                      ? "bg-blue-700 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {category.emoji} {category.shortLabel}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">ランキング</h2>

          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-500 shadow-sm">
            {rankings.length} AI
          </span>
        </section>

        <section className="space-y-4">
          {rankings.map((row, index) => (
            <article
              key={row.key}
              className="rounded-[28px] bg-white p-4 shadow-sm"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-900 text-lg font-black text-white">
                    {rankBadge(index)}
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold leading-tight">
                      {row.ai}
                    </h3>

                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${sourceClass(
                          row.source
                        )}`}
                      >
                        {sourceLabel(row.source)}
                      </span>

                      {row.myAiId && (
                        <Link
                          href={`/my-ai/${row.myAiId}`}
                          className="text-[11px] font-extrabold text-blue-700"
                        >
                          詳細
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-black text-blue-700">
                    {formatAccuracy(row.accuracy)}
                  </div>
                  <div className="text-[11px] font-bold text-gray-400">
                    的中率
                  </div>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-gray-50 p-3">
                  <div className="text-[11px] font-bold text-gray-400">
                    予測数
                  </div>
                  <div className="mt-1 text-lg font-extrabold">
                    {row.total}
                  </div>
                </div>

                <div className="rounded-2xl bg-blue-50 p-3">
                  <div className="text-[11px] font-bold text-blue-500">
                    的中
                  </div>
                  <div className="mt-1 text-lg font-extrabold text-blue-700">
                    {row.hits}
                  </div>
                </div>

                <div className="rounded-2xl bg-gray-50 p-3">
                  <div className="text-[11px] font-bold text-gray-400">
                    外れ
                  </div>
                  <div className="mt-1 text-lg font-extrabold">
                    {row.total - row.hits}
                  </div>
                </div>
              </div>

              <div className="mb-4 h-3 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-blue-700"
                  style={{ width: `${Math.round(row.accuracy * 100)}%` }}
                />
              </div>

              <div className="rounded-2xl bg-gray-50 p-3">
                <div className="mb-2 text-xs font-extrabold text-gray-500">
                  最近の判定
                </div>

                <div className="space-y-2">
                  {row.history.slice(0, 3).map((item) => (
                    <Link
                      key={`${row.key}-${item.eventId}`}
                      href={`/race/${item.eventId}`}
                      className="block rounded-2xl bg-white p-3"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-extrabold">
                          {item.title}
                        </span>

                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-extrabold ${
                            item.hit
                              ? "bg-blue-50 text-blue-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {item.hit ? "的中" : "外れ"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-gray-400">
                        <span>
                          {getCategoryEmoji(item.category)}{" "}
                          {getCategoryLabel(item.category)}
                        </span>

                        <span className="truncate">
                          予測: {item.pick} / 結果: {item.winner}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </article>
          ))}

          {rankings.length === 0 && (
            <div className="rounded-[28px] bg-white p-6 text-center shadow-sm">
              <div className="text-3xl">🏁</div>

              <h3 className="mt-3 text-lg font-extrabold">
                まだランキング対象がありません
              </h3>

              <p className="mt-2 text-sm font-bold leading-6 text-gray-500">
                結果入力済みで、AI予測が入っているイベントが増えるとランキングが表示されます。
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Link
                  href="/admin/results"
                  className="rounded-2xl bg-blue-700 py-4 text-center text-sm font-extrabold text-white"
                >
                  結果入力へ
                </Link>

                <Link
                  href="/races"
                  className="rounded-2xl bg-gray-100 py-4 text-center text-sm font-extrabold text-gray-700"
                >
                  イベント一覧
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </main>
  );
}