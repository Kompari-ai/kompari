import type { EventCategory } from "@/lib/categories";
import type { PredictionFactor } from "@/lib/factors";

export type KompariPrediction = {
  ai: string;
  // 例: "openai", "anthropic", "google", "deepseek", "xai"
  aiProvider?: string;
  // 表示用モデル名。例: "GPT-5.5", "Claude Opus 4.8"
  aiModel?: string;
  // API呼び出しに使った実際のモデルID。例: "gpt-5.5", "claude-opus-4-8"
  aiModelId?: string;
  main: string;
  second?: string;
  third?: string;
  confidence?: string;
  reason?: string;
  evidence?: string;

  // official AI or user-created AI
  source?: "official" | "user";

  // Firestore ID for My AI
  myAiId?: string;

  // Factor Tags（方針16）。表示・分析用のリッチな構造
  usedFactors?: PredictionFactor[];
  // Factor Tags の検索用キー一覧（Firestore array-contains 用）
  factorKeys?: string[];

  // 集計の整合性のための土台フィールド(方針: MVP監査で確定)。
  // 失敗/欠落/モック予測を、コンセンサスと的中率の母数から正しく扱うために使う。
  // outcome未確定(undefined)の旧データは、集計側で従来の動的計算にフォールバックする。
  isMock?: boolean;

  // predictionSource の境界:
  //   official-ai: Kompari公式AI(ChatGPT/Claude/Gemini/DeepSeek/Grok)
  //   my-ai:       Kompari内のユーザー所有AI(myAis / myAiId で管理)
  //   custom-ai:   外部エンドポイント接続。将来の独立プロダクト級。MVPでは凍結
  //   mock:        API失敗時/開発用のモック予測。商用集計から除外・別扱い
  //   manual:      管理画面等から人間が手入力・補正した予測
  predictionSource?: "official-ai" | "my-ai" | "custom-ai" | "mock" | "manual";

  outcome?: "pending" | "hit" | "miss" | "void" | "unknown";
};

export type KompariEvent = {
  id: string;
  category: EventCategory;
  title: string;

  // 候補リスト
  candidates: string[];

  startsAt?: string;
  participants?: string[];
  predictions: KompariPrediction[];

  result?: {
    winner?: string;
    second?: string;
    third?: string;
  };

  venue?: string;
  startsIn?: string;
  resultWinner?: string;
  createdAt?: unknown;
};

export type LegacyRaceData = {
  id: string;
  category?: string;
  title?: string;
  venue?: string;
  startsAt?: string;
  startsIn?: string;
  resultWinner?: string;
  candidates?: string[];
  predictions?: KompariPrediction[];
  createdAt?: unknown;
  result?: {
    winner?: string;
    second?: string;
    third?: string;
  };
};

export function normalizeRaceToEvent(race: LegacyRaceData): KompariEvent {
  const predictions = race.predictions || [];

  return {
    id: race.id,
    category: normalizeCategory(race.category),
    title: race.title || "無題のイベント",

    candidates: normalizeCandidates(race.candidates, predictions),

    startsAt: race.startsAt || undefined,
    participants: [],
    predictions,

    result: race.resultWinner
      ? {
          winner: race.resultWinner,
        }
      : race.result || undefined,

    venue: race.venue || "",
    startsIn: race.startsIn || "",
    resultWinner: race.resultWinner || race.result?.winner || "",
    createdAt: race.createdAt,
  };
}

export function getResultWinner(event: KompariEvent): string {
  return (event.result?.winner || event.resultWinner || "").trim();
}

export function getConsensusChip(
  predictions: KompariPrediction[]
): { type: "unan" | "lean" | "split"; label: string } | null {
  const officialPreds = predictions.filter((p) => p.source !== "user");
  if (officialPreds.length === 0) return null;

  const mains = officialPreds
    .map((p) => p.main)
    .filter((m): m is string => !!m);
  const unique = new Set(mains);

  if (unique.size <= 1) return { type: "unan", label: "全会一致" };

  const counts: Record<string, number> = {};
  mains.forEach((m) => {
    counts[m] = (counts[m] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const topCount = sorted[0]?.[1] ?? 0;
  const topName = sorted[0]?.[0] ?? "";

  if (topCount > officialPreds.length / 2) {
    return { type: "lean", label: `${topName}優勢` };
  }

  return { type: "split", label: "意見が真っ二つ" };
}

export function formatStartsAt(startsAt?: string): string {
  if (!startsAt) return "";
  const date = new Date(startsAt);
  if (isNaN(date.getTime())) return "";
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}月${day}日(${dayOfWeek}) ${hours}:${minutes}`;
}

function normalizeCandidates(
  candidates: string[] | undefined,
  predictions: KompariPrediction[]
) {
  if (Array.isArray(candidates) && candidates.length > 0) {
    return candidates
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);
  }

  const fallback = new Set<string>();

  predictions.forEach((prediction) => {
    if (prediction.main) fallback.add(prediction.main);
    if (prediction.second) fallback.add(prediction.second);
    if (prediction.third) fallback.add(prediction.third);
  });

  return Array.from(fallback);
}

function normalizeCategory(category?: string): EventCategory {
  if (
    category === "horse_racing" ||
    category === "nba" ||
    category === "soccer" ||
    category === "mlb" ||
    category === "crypto" ||
    category === "stocks" ||
    category === "election" ||
    category === "esports"
  ) {
    return category;
  }

  return "horse_racing";
}