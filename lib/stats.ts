import type { KompariEvent, KompariPrediction } from "@/lib/events";
import { getResultWinner } from "@/lib/events";

export type CategoryStats = {
  total: number;
  finished: number;
  hits: number;
  hitRate: number | null;
};

export type BrandStats = {
  // aiProvider ?? ai ?? "unknown"
  key: string;
  // prediction.ai (human-readable display name, e.g. "ChatGPT")
  displayName: string;
  total: number;
  finished: number;
  hits: number;
  hitRate: number | null;
  categories: Record<string, CategoryStats>;
};

export type ModelStats = {
  // aiModelId ?? aiModel ?? ai ?? "unknown"
  key: string;
  // aiModel ?? ai ?? "unknown"
  displayName: string;
  // aiProvider ?? ai ?? "unknown"
  brandKey: string;
  total: number;
  finished: number;
  hits: number;
  hitRate: number | null;
  categories: Record<string, CategoryStats>;
};

function computeHitRate(hits: number, finished: number): number | null {
  if (finished === 0) return null;
  return Math.round((hits / finished) * 1000) / 10;
}

function getBrandKey(prediction: KompariPrediction): string {
  return prediction.aiProvider ?? prediction.ai ?? "unknown";
}

function getModelKey(prediction: KompariPrediction): string {
  return prediction.aiModelId ?? prediction.aiModel ?? prediction.ai ?? "unknown";
}

function getModelDisplayName(prediction: KompariPrediction): string {
  return prediction.aiModel ?? prediction.ai ?? "unknown";
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
 * ブランド別(aiProvider)に成績を集計する。
 * aiProvider がない古いデータは prediction.ai をキーに使う。
 * official / user 両方を含む(buildRankings に倣う)。
 */
export function aggregateByBrand(events: KompariEvent[]): BrandStats[] {
  const map = new Map<string, BrandStats>();

  for (const event of events) {
    const winner = getResultWinner(event);
    const isFinished = !!winner;

    for (const prediction of event.predictions) {
      const pick = prediction.main?.trim();
      if (!pick) continue;

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
        });
      }

      const entry = map.get(key)!;
      const hit = isFinished && pick === winner;

      entry.total += 1;

      if (isFinished) {
        entry.finished += 1;
        if (hit) entry.hits += 1;
        entry.hitRate = computeHitRate(entry.hits, entry.finished);
      }

      accumulateCategoryStats(entry.categories, event.category, isFinished, hit);
    }
  }

  return sortByHits(Array.from(map.values()));
}

/**
 * モデルバージョン別(aiModelId)に成績を集計する。
 * aiModelId がない古いデータは aiModel → ai の順にフォールバックする。
 * official / user 両方を含む(buildRankings に倣う)。
 */
export function aggregateByModel(events: KompariEvent[]): ModelStats[] {
  const map = new Map<string, ModelStats>();

  for (const event of events) {
    const winner = getResultWinner(event);
    const isFinished = !!winner;

    for (const prediction of event.predictions) {
      const pick = prediction.main?.trim();
      if (!pick) continue;

      const key = getModelKey(prediction);
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
        });
      }

      const entry = map.get(key)!;
      const hit = isFinished && pick === winner;

      entry.total += 1;

      if (isFinished) {
        entry.finished += 1;
        if (hit) entry.hits += 1;
        entry.hitRate = computeHitRate(entry.hits, entry.finished);
      }

      accumulateCategoryStats(entry.categories, event.category, isFinished, hit);
    }
  }

  return sortByHits(Array.from(map.values()));
}
