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
import { getAiColors, getAiInitial } from "@/lib/ai-colors";
import {
  getResultWinner,
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

function rankBadge(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `${index + 1}`;
}

function AiAvatar({ aiName, source }: { aiName: string; source: "official" | "user" }) {
  if (source === "user") {
    return (
      <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-sm font-extrabold text-white bg-purple-500">
        {aiName.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  const colors = getAiColors(aiName);

  return (
    <div
      className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-sm font-extrabold"
      style={{ background: colors.bg, color: colors.text }}
    >
      {getAiInitial(aiName)}
    </div>
  );
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

  const overallAccuracy = totalPredictions ? totalHits / totalPredictions : 0;

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
                "linear-gradient(135deg, #111827 0%, #1d4ed8 55%, #2563eb 100%)",
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold tracking-[0.18em] text-white">
                AI RANKING
              </span>
              <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-extrabold text-white">
                1着的中
              </span>
            </div>

            <h1 className="text-[30px] font-black leading-tight tracking-tight">
              AI的中
              <br />
              ランキング
            </h1>

            <p className="mt-3 text-[12px] font-semibold leading-[1.6] text-white/70">
              結果入力済みイベントをもとに、各AIの本命予測が実際の勝者と一致したかを集計します。
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-[12px] bg-white/10 p-2.5">
                <div className="text-[10px] text-white/65">対象</div>
                <div className="mt-0.5 text-xl font-extrabold">
                  {targetEvents.length}
                </div>
              </div>
              <div className="rounded-[12px] bg-white/10 p-2.5">
                <div className="text-[10px] text-white/65">的中</div>
                <div className="mt-0.5 text-xl font-extrabold">{totalHits}</div>
              </div>
              <div className="rounded-[12px] bg-white/10 p-2.5">
                <div className="text-[10px] text-white/65">的中率</div>
                <div className="mt-0.5 text-xl font-extrabold">
                  {formatAccuracy(overallAccuracy)}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="mb-4 rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-sm">
          <div className="mb-2 text-[11px] font-bold text-gray-500">フィルター</div>

          <div className="flex bg-[#E7EBF2] rounded-[12px] p-[3px] mb-3">
            {[
              { value: "all", label: "すべて" },
              { value: "official", label: "公式AI" },
              { value: "user", label: "My AI" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setSourceFilter(item.value as SourceFilter)}
                className={`flex-1 py-2 text-[13px] font-bold rounded-[10px] transition-colors ${
                  sourceFilter === item.value
                    ? "bg-white text-[#0F172A] shadow-sm"
                    : "text-[#64748B]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-bold ${
                categoryFilter === "all"
                  ? "bg-[#0F172A] text-white border-[#0F172A]"
                  : "bg-white text-[#64748B] border-[#E8ECF2]"
              }`}
            >
              全カテゴリ
            </button>

            {eventCategories.map((category) => (
              <button
                key={category.value}
                type="button"
                onClick={() => setCategoryFilter(category.value)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-bold ${
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
          <h2 className="text-[15.5px] font-bold">ランキング</h2>
          <span className="rounded-full border border-[#E8ECF2] bg-white px-3 py-1 text-[11px] font-bold text-gray-500 shadow-sm">
            {rankings.length} AI
          </span>
        </section>

        <section className="space-y-4">
          {rankings.map((row, index) => {
            const colors = row.source === "official" ? getAiColors(row.ai) : null;

            return (
              <article
                key={row.key}
                className="rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-sm"
              >
                {/* Header row */}
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Rank badge */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-gray-900 text-base font-black text-white">
                      {rankBadge(index)}
                    </div>

                    <div>
                      <h3 className="text-[15px] font-extrabold leading-tight">
                        {row.ai}
                      </h3>
                      <div className="mt-1 flex items-center gap-2">
                        <AiAvatar aiName={row.ai} source={row.source} />
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
                    <div
                      className="text-[22px] font-black"
                      style={{ color: colors?.bg ?? "#6366f1" }}
                    >
                      {formatAccuracy(row.accuracy)}
                    </div>
                    <div className="text-[10px] font-bold text-gray-400">的中率</div>
                  </div>
                </div>

                {/* Stats */}
                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-[10px] bg-gray-50 p-2.5">
                    <div className="text-[10px] font-bold text-gray-400">予測数</div>
                    <div className="mt-0.5 text-base font-extrabold">{row.total}</div>
                  </div>
                  <div className="rounded-[10px] bg-green-50 p-2.5">
                    <div className="text-[10px] font-bold text-green-600">的中</div>
                    <div className="mt-0.5 text-base font-extrabold text-green-700">
                      {row.hits}
                    </div>
                  </div>
                  <div className="rounded-[10px] bg-red-50 p-2.5">
                    <div className="text-[10px] font-bold text-red-400">外れ</div>
                    <div className="mt-0.5 text-base font-extrabold text-red-600">
                      {row.total - row.hits}
                    </div>
                  </div>
                </div>

                {/* Accuracy bar */}
                <div className="mb-3 h-[9px] overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${Math.round(row.accuracy * 100)}%`,
                      background: colors?.bg ?? "#6366f1",
                    }}
                  />
                </div>

                {/* Recent history */}
                <div className="rounded-[12px] bg-[#F8FAFC] p-3">
                  <div className="mb-2 text-[11px] font-extrabold text-gray-500">
                    最近の判定
                  </div>

                  <div className="space-y-2">
                    {row.history.slice(0, 3).map((item) => (
                      <Link
                        key={`${row.key}-${item.eventId}`}
                        href={`/race/${item.eventId}`}
                        className="flex items-center justify-between gap-2 rounded-[10px] bg-white p-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-extrabold">
                            {item.title}
                          </div>
                          <div className="text-[10px] font-bold text-gray-400 mt-0.5">
                            {getCategoryEmoji(item.category)}{" "}
                            {getCategoryLabel(item.category)} ｜ 予測:{item.pick} / 結果:{item.winner}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
                            item.hit
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {item.hit ? "的中" : "外れ"}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}

          {rankings.length === 0 && (
            <div className="rounded-[18px] border border-[#E8ECF2] bg-white p-6 text-center shadow-sm">
              <div className="text-3xl">🏁</div>

              <h3 className="mt-3 text-lg font-extrabold">
                まだランキング対象がありません
              </h3>

              <p className="mt-2 text-sm font-bold leading-6 text-gray-500">
                結果入力済みで、AI予測が入っているイベントが増えるとランキングが表示されます。
              </p>

              <div className="mt-5">
                <Link
                  href="/races"
                  className="block rounded-[12px] bg-blue-700 py-4 text-center text-sm font-extrabold text-white"
                >
                  イベント一覧へ
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
