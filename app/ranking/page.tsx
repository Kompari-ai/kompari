"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, collectionGroup, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import {
  publicEventCategories,
  getCategoryEmoji,
  getCategoryLabel,
  type EventCategory,
} from "@/lib/categories";
import { getAiColors, getAiInitial } from "@/lib/ai-colors";
import {
  getResultWinner,
  isPublicEvent,
  normalizeEventDocToEvent,
  type KompariEvent,
  type KompariEventDoc,
  type KompariPrediction,
  type KompariPredictionDoc,
} from "@/lib/events";
import {
  aggregateByBrand,
  aggregateByModel,
  getPredictionSource,
  isCountableForSource,
  type BrandStats,
  type ModelStats,
  type HistoryItem,
  type PredictionSourceKind,
} from "@/lib/stats";

type AggregationMode = "ai" | "brand" | "model";
type CategoryFilter = "all" | EventCategory;
type SourceFilter = "all" | "official" | "user";

// ranking の行・カードは unknown を一切保持しない(buildRankings で除外済み)。
// 公開UIに unknown を出さない方針のため、型も official|user のみに絞る。
type KnownPredictionSource = Exclude<PredictionSourceKind, "unknown">;

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
  source: KnownPredictionSource;
  myAiId?: string;
  total: number;
  hits: number;
  accuracy: number;
  history: RankingHistory[];
};

// 3モードを統一して描画する共通型
type CardRow = {
  key: string;
  displayName: string;
  source: KnownPredictionSource;
  myAiId?: string;
  total: number;     // 全予測数(未確定含む)
  finished: number;  // 結果確定済み予測数
  hits: number;
  miss: number;      // finished - hits
  hitRatePercent: number | null; // 0-100 または null(データなし)
  history: HistoryItem[];
};

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
      const source = getPredictionSource(prediction);
      // unknown は集計対象外(RankingRow.source は official|user のみを保持する)。
      if (source === "unknown") return;
      if (!isCountableForSource(prediction, source)) return;

      const pick = prediction.main.trim();
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

// buildRankings は未確定イベントをスキップするため total === finished
function rankingToCard(row: RankingRow): CardRow {
  return {
    key: row.key,
    displayName: row.ai,
    source: row.source,
    myAiId: row.myAiId,
    total: row.total,
    finished: row.total,
    hits: row.hits,
    miss: row.total - row.hits,
    hitRatePercent: row.total > 0 ? Math.round(row.accuracy * 1000) / 10 : null,
    history: row.history,
  };
}

function brandToCard(row: BrandStats): CardRow {
  return {
    key: row.key,
    displayName: row.displayName,
    source: "official",
    total: row.total,
    finished: row.finished,
    hits: row.hits,
    miss: row.finished - row.hits,
    hitRatePercent: row.hitRate,
    history: row.history,
  };
}

function modelToCard(row: ModelStats): CardRow {
  return {
    key: row.key,
    displayName: row.displayName,
    source: "official",
    total: row.total,
    finished: row.finished,
    hits: row.hits,
    miss: row.finished - row.hits,
    hitRatePercent: row.hitRate,
    history: row.history,
  };
}

function formatRate(value: number | null): string {
  if (value === null) return "-";
  return `${value}%`;
}

function rankCircleClass(index: number): string {
  if (index === 0) return "bg-amber-400 text-white";
  if (index === 1) return "bg-gray-300 text-gray-700";
  if (index === 2) return "bg-orange-500 text-white";
  return "bg-gray-100 text-gray-400";
}

function AiAvatar({ aiName, source }: { aiName: string; source: KnownPredictionSource }) {
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
  const [eventDocs, setEventDocs] = useState<KompariEventDoc[] | null>(null);
  const [predsMap, setPredsMap] = useState<Map<string, KompariPredictionDoc[]> | null>(null);
  const [aggregationMode, setAggregationMode] = useState<AggregationMode>("ai");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("official");

  const events = useMemo<KompariEvent[] | null>(() => {
    if (!eventDocs || !predsMap) return null;
    return eventDocs.map((doc) => normalizeEventDocToEvent(doc, predsMap.get(doc.id) ?? []));
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
          const eventId = pred.eventId || d.ref.parent.parent?.id;
          if (!eventId) continue;
          if (!map.has(eventId)) map.set(eventId, []);
          map.get(eventId)!.push(pred);
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

  const finishedEvents = useMemo(() => {
    if (!publicEvents) return [];
    return publicEvents.filter((event) => !!getResultWinner(event));
  }, [publicEvents]);

  const targetEvents = useMemo(() => {
    return finishedEvents.filter((event) => {
      if (categoryFilter === "all") return true;
      return event.category === categoryFilter;
    });
  }, [finishedEvents, categoryFilter]);

  // "ai" モード: 既存の buildRankings をそのまま使用
  const aiCards = useMemo(() => {
    return buildRankings(targetEvents)
      .filter((row) => {
        if (sourceFilter === "all") return true;
        return row.source === sourceFilter;
      })
      .map(rankingToCard);
  }, [targetEvents, sourceFilter]);

  // "brand" モード: 公式AIのみ対象、category/source フィルタ無効
  const brandCards = useMemo(() => {
    if (!publicEvents) return [];
    return aggregateByBrand(publicEvents, { source: "official" }).map(brandToCard);
  }, [publicEvents]);

  // "model" モード: 公式AIのみ・aiModel/aiModelId 有りのデータのみ対象
  const modelCards = useMemo(() => {
    if (!publicEvents) return [];
    return aggregateByModel(publicEvents, { source: "official" }).map(modelToCard);
  }, [publicEvents]);

  const activeCards = useMemo(() => {
    if (aggregationMode === "ai") return aiCards;
    if (aggregationMode === "brand") return brandCards;
    return modelCards;
  }, [aggregationMode, aiCards, brandCards, modelCards]);

  const headerHits = useMemo(
    () => activeCards.reduce((s, r) => s + r.hits, 0),
    [activeCards]
  );
  const headerFinished = useMemo(
    () => activeCards.reduce((s, r) => s + r.finished, 0),
    [activeCards]
  );
  const headerRateForDisplay: number | null =
    headerFinished > 0
      ? Math.round((headerHits / headerFinished) * 1000) / 10
      : null;

  const badgeLabel =
    aggregationMode === "ai"
      ? `${activeCards.length} AI`
      : aggregationMode === "brand"
      ? `${activeCards.length} ブランド`
      : `${activeCards.length} モデル`;

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
        {/* Header */}
        <section className="mb-4 overflow-hidden rounded-[18px] border border-[#E8ECF2] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div
            className="p-5 text-white"
            style={{
              background:
                "linear-gradient(150deg, var(--color-brand) 0%, var(--color-brand-soft) 100%)",
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
                <div className="text-[10px] text-white/65">確定予測</div>
                <div className="mt-0.5 text-xl font-extrabold [font-variant-numeric:tabular-nums]">
                  {headerFinished}
                </div>
              </div>
              <div className="rounded-[12px] bg-white/10 p-2.5">
                <div className="text-[10px] text-white/65">的中予測</div>
                <div className="mt-0.5 text-xl font-extrabold [font-variant-numeric:tabular-nums]">
                  {headerHits}
                </div>
              </div>
              <div className="rounded-[12px] bg-white/10 p-2.5">
                <div className="text-[10px] text-white/65">的中率</div>
                <div className="mt-0.5 text-xl font-extrabold [font-variant-numeric:tabular-nums]">
                  {formatRate(headerRateForDisplay)}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="mb-4 rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="mb-2 text-[11px] font-bold text-gray-500">集計軸</div>

          {/* Aggregation mode — 3択セグメントコントロール */}
          <div className="flex bg-[#E7EBF2] rounded-[12px] p-[3px] mb-3">
            {(
              [
                { value: "ai" as AggregationMode, label: "AI別" },
                { value: "brand" as AggregationMode, label: "ブランド別" },
                { value: "model" as AggregationMode, label: "モデル別" },
              ]
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setAggregationMode(item.value);
                  if (item.value !== "ai") {
                    setSourceFilter("all");
                    setCategoryFilter("all");
                  } else {
                    setSourceFilter("official");
                  }
                }}
                className={`flex-1 py-2 text-[13px] font-bold rounded-[10px] transition-colors ${
                  aggregationMode === item.value
                    ? "bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
                    : "text-[#64748B]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Source filter + カテゴリ: ai モードのみ表示 */}
          {aggregationMode === "ai" && (
            <>
              <div className="mb-2 text-[11px] font-bold text-gray-500">フィルター</div>

              <div className="flex bg-[#E7EBF2] rounded-[12px] p-[3px] mb-3">
                {[
                  { value: "official", label: "公式AI" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSourceFilter(item.value as SourceFilter)}
                    className={`flex-1 py-2 text-[13px] font-bold rounded-[10px] transition-colors ${
                      sourceFilter === item.value
                        ? "bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
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

                {publicEventCategories.map((category) => (
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
            </>
          )}
        </section>

        <section className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold">ランキング</h2>
          <span className="rounded-full border border-[#E8ECF2] bg-white px-3 py-1 text-[11px] font-bold text-gray-500 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            {badgeLabel}
          </span>
        </section>

        <section className="space-y-4">
          {activeCards.map((card, index) => {
            const colors = card.source === "official" ? getAiColors(card.displayName) : null;
            const barWidth = Math.round(card.hitRatePercent ?? 0);

            return (
              <article
                key={card.key}
                className="rounded-[18px] border border-[#E8ECF2] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
              >
                {/* Header row */}
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${rankCircleClass(index)}`}
                    >
                      {index + 1}
                    </div>

                    <AiAvatar aiName={card.displayName} source={card.source} />

                    <div>
                      <h3 className="text-[15px] font-extrabold leading-tight">
                        {card.displayName}
                      </h3>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className="text-[22px] font-black"
                      style={{ color: colors?.bg ?? "#6366f1" }}
                    >
                      {formatRate(card.hitRatePercent)}
                    </div>
                    <div className="text-[10px] font-bold text-gray-400">的中率</div>
                  </div>
                </div>

                {/* Stats */}
                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-[10px] bg-gray-50 p-2.5">
                    <div className="text-[10px] font-bold text-gray-400">予測数</div>
                    <div className="mt-0.5 text-base font-extrabold">{card.total}</div>
                  </div>
                  <div className="rounded-[10px] bg-green-50 p-2.5">
                    <div className="text-[10px] font-bold text-green-600">的中</div>
                    <div className="mt-0.5 text-base font-extrabold text-green-700">
                      {card.hits}
                    </div>
                  </div>
                  <div className="rounded-[10px] bg-red-50 p-2.5">
                    <div className="text-[10px] font-bold text-red-400">外れ</div>
                    <div className="mt-0.5 text-base font-extrabold text-red-600">
                      {card.miss}
                    </div>
                  </div>
                </div>

                {/* Accuracy bar */}
                <div className="mb-3 h-[9px] overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${barWidth}%`,
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
                    {card.history.slice(0, 3).map((item) => (
                      <Link
                        key={`${card.key}-${item.eventId}`}
                        href={`/events/${item.eventId}`}
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
                    {card.history.length === 0 && (
                      <p className="text-center text-[12px] font-bold text-gray-400 py-2">
                        まだ判定済みの予測はありません
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {activeCards.length === 0 && (
            <div className="rounded-[18px] border border-[#E8ECF2] bg-white p-6 text-center shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
              <div className="text-3xl">🏁</div>

              <h3 className="mt-3 text-lg font-extrabold">
                まだランキング対象がありません
              </h3>

              <p className="mt-2 text-sm font-bold leading-6 text-gray-500">
                結果入力済みで、AI予測が入っているイベントが増えるとランキングが表示されます。
              </p>

              <div className="mt-5">
                <Link
                  href="/events"
                  className="block rounded-[12px] bg-brand py-4 text-center text-sm font-extrabold text-white"
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
