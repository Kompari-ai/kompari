import type { KompariEvent, KompariPrediction } from "@/lib/events";
import { getResultWinner, isCountablePrediction, isOfficialPrediction } from "@/lib/events";
import type { EventCategory } from "@/lib/categories";
import { isOfficialAiName } from "@/lib/ai/official-ai";

export type StatsSourceFilter = "official" | "user" | "all";

type StatsOptions = {
  source?: StatsSourceFilter;
};

// RankingHistory(ranking/page.tsx)と互換のフィールド名にする。
// page.tsx から直接 import しない。
export type HistoryItem = {
  eventId: string;
  title: string;
  category: EventCategory;
  winner: string;
  pick: string;
  hit: boolean;
};

export type CategoryStats = {
  total: number;
  finished: number;
  hits: number;
  hitRate: number | null;
};

export type BrandStats = {
  // prediction.ai (displayName) をキーに統一
  key: string;
  // prediction.ai (human-readable display name, e.g. "ChatGPT")
  displayName: string;
  total: number;
  finished: number;
  hits: number;
  hitRate: number | null;
  categories: Record<string, CategoryStats>;
  // 確定済みイベントのみ。呼び出し元の events 順(createdAt desc 想定)で格納。
  history: HistoryItem[];
};

export type ModelStats = {
  // aiModelId ?? aiModel (ai へのフォールバックなし)
  key: string;
  // aiModel ?? aiModelId ?? "unknown"
  displayName: string;
  // prediction.ai (displayName) をキーに統一
  brandKey: string;
  total: number;
  finished: number;
  hits: number;
  hitRate: number | null;
  categories: Record<string, CategoryStats>;
  // 確定済みイベントのみ。呼び出し元の events 順(createdAt desc 想定)で格納。
  history: HistoryItem[];
};

function computeHitRate(hits: number, finished: number): number | null {
  if (finished === 0) return null;
  return Math.round((hits / finished) * 1000) / 10;
}

export function getPredictionSource(prediction: KompariPrediction): "official" | "user" {
  if (prediction.source === "user") return "user";
  if (prediction.myAiId) return "user";
  if (isOfficialAiName(prediction.ai)) return "official";
  return "user";
}

// 集計可否のSoT。公式は official-ai 厳格判定、My AI は従来の集計可能性判定。
// 分類は呼び出し側で一度だけ行い、その結果を source として受け取る(二重分類を避ける)。
export function isCountableForSource(
  prediction: KompariPrediction,
  source: "official" | "user"
): boolean {
  if (source === "official") return isOfficialPrediction(prediction);
  if (source === "user") return isCountablePrediction(prediction);
  return false; // 将来 getPredictionSource が分類を増やした場合の安全側デフォルト
}

// ブランドキーは ai フィールド(displayName)に統一。
// aiProvider はモック時に欠落するため使わない。
function getBrandKey(prediction: KompariPrediction): string {
  return prediction.ai ?? "unknown";
}

// aiModelId/aiModel が両方ない場合は null を返してモデル別集計から除外。
// ai へのフォールバックは意図的に省く(モデル不明予測を "ChatGPT" と混同させない)。
function getModelKey(prediction: KompariPrediction): string | null {
  return prediction.aiModel ?? prediction.aiModelId ?? null;
}

function getModelDisplayName(prediction: KompariPrediction): string {
  return prediction.aiModel ?? prediction.aiModelId ?? "unknown";
}

function accumulateCategoryStats(
  categories: Record<string, CategoryStats>,
  category: string,
  isFinished: boolean,
  hit: boolean
): void {
  if (!categories[category]) {
    categories[category] = { total: 0, finished: 0, hits: 0, hitRate: null };
  }

  const cat = categories[category];
  cat.total += 1;

  if (isFinished) {
    cat.finished += 1;
    if (hit) cat.hits += 1;
    cat.hitRate = computeHitRate(cat.hits, cat.finished);
  }
}

function sortByHits<T extends { hits: number; hitRate: number | null; total: number }>(
  rows: T[]
): T[] {
  return rows.sort((a, b) => {
    if (b.hits !== a.hits) return b.hits - a.hits;
    const aRate = a.hitRate ?? 0;
    const bRate = b.hitRate ?? 0;
    if (bRate !== aRate) return bRate - aRate;
    return b.total - a.total;
  });
}

/**
 * ブランド別(ai displayName)に成績を集計する。
 * ブランドキーは prediction.ai に統一(aiProvider はモック時に欠落するため使わない)。
 * source オプションで公式AI / My AI / 両方 を切り替えられる。
 */
export function aggregateByBrand(events: KompariEvent[], options?: StatsOptions): BrandStats[] {
  const sourceFilter = options?.source ?? "all";
  const map = new Map<string, BrandStats>();

  for (const event of events) {
    const winner = getResultWinner(event);
    const isFinished = !!winner;

    for (const prediction of event.predictions) {
      const source = getPredictionSource(prediction);
      if (sourceFilter !== "all" && source !== sourceFilter) continue;
      if (!isCountableForSource(prediction, source)) continue;

      const pick = prediction.main.trim();
      const key = getBrandKey(prediction);

      if (!map.has(key)) {
        map.set(key, {
          key,
          displayName: prediction.ai ?? key,
          total: 0,
          finished: 0,
          hits: 0,
          hitRate: null,
          categories: {},
          history: [],
        });
      }

      const entry = map.get(key)!;
      const hit = isFinished && pick === winner;

      entry.total += 1;

      if (isFinished) {
        entry.finished += 1;
        if (hit) entry.hits += 1;
        entry.hitRate = computeHitRate(entry.hits, entry.finished);
        entry.history.push({
          eventId: event.id,
          title: event.title,
          category: event.category,
          winner,
          pick,
          hit,
        });
      }

      accumulateCategoryStats(entry.categories, event.category, isFinished, hit);
    }
  }

  return sortByHits(Array.from(map.values()));
}

/**
 * モデルバージョン別(aiModelId / aiModel)に成績を集計する。
 * aiModelId も aiModel も無い予測(モックデータ等)は集計から除外する。
 * ai へのフォールバックは意図的に省く(GPT-5.5 と ChatGPT が混在する事故を防ぐ)。
 * source オプションで公式AI / My AI / 両方 を切り替えられる。
 */
export function aggregateByModel(events: KompariEvent[], options?: StatsOptions): ModelStats[] {
  const sourceFilter = options?.source ?? "all";
  const map = new Map<string, ModelStats>();

  for (const event of events) {
    const winner = getResultWinner(event);
    const isFinished = !!winner;

    for (const prediction of event.predictions) {
      const source = getPredictionSource(prediction);
      if (sourceFilter !== "all" && source !== sourceFilter) continue;
      if (!isCountableForSource(prediction, source)) continue;

      const pick = prediction.main.trim();
      const key = getModelKey(prediction);
      if (key === null) continue; // aiModelId/aiModel なし → モデル別集計から除外

      const brandKey = getBrandKey(prediction);

      if (!map.has(key)) {
        map.set(key, {
          key,
          displayName: getModelDisplayName(prediction),
          brandKey,
          total: 0,
          finished: 0,
          hits: 0,
          hitRate: null,
          categories: {},
          history: [],
        });
      }

      const entry = map.get(key)!;
      const hit = isFinished && pick === winner;

      entry.total += 1;

      if (isFinished) {
        entry.finished += 1;
        if (hit) entry.hits += 1;
        entry.hitRate = computeHitRate(entry.hits, entry.finished);
        entry.history.push({
          eventId: event.id,
          title: event.title,
          category: event.category,
          winner,
          pick,
          hit,
        });
      }

      accumulateCategoryStats(entry.categories, event.category, isFinished, hit);
    }
  }

  return sortByHits(Array.from(map.values()));
}
