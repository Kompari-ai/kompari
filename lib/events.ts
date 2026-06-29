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

// events コレクション(新) 1ドキュメントの型。
// resultWinner(トップレベル)は新EventDocでは持たない。result.winner に一本化する
//   (移行スクリプトで旧 resultWinner → result.winner に統合する想定)。
// predictions 配列も EventDocには持たない(predictions サブコレクションに分離)。
// startsIn(自由テキスト)も持たない(startsAt のISO8601に一本化)。
export type KompariEventDoc = {
  id: string;
  slug?: string;
  category: EventCategory;
  title: string;
  candidates: string[];
  venue?: string;
  startsAt?: string;
  result?: {
    winner?: string;
    second?: string;
    third?: string;
  };
  createdAt?: unknown;
  updatedAt?: unknown;
  predictionCount?: number;
};

// events/{eventId}/predictions サブコレクション(新) 1ドキュメントの型。
// 既存 KompariPrediction(optional)とは別の新型。新コレクション専用。
// isMock/predictionSource/outcome は必須にして undefined を作らない方針。
// confidence は現状の string 混在(72/medium/high)のまま維持。数値化は将来別タスク。
export type KompariPredictionDoc = {
  eventId: string;
  predictionId: string;
  ai: string;
  aiProvider?: string;
  aiModel?: string;
  aiModelId?: string;
  main: string;
  second?: string;
  third?: string;
  confidence?: string;
  reason?: string;
  evidence?: string;
  isMock: boolean;
  predictionSource: "official-ai" | "my-ai" | "custom-ai" | "mock" | "manual";
  source?: "official" | "user";
  myAiId?: string;
  outcome: "pending" | "hit" | "miss" | "void" | "unknown";
  usedFactors?: PredictionFactor[];
  factorKeys?: string[];
  predictedAt?: unknown;
  evaluatedAt?: unknown;
  updatedAt?: unknown;
};

export function normalizeEventDocToEvent(
  doc: KompariEventDoc,
  predictions: KompariPredictionDoc[]
): KompariEvent {
  const winner = (doc.result?.winner ?? "").trim();
  const isFinished = !!winner;

  const normalizedPredictions: KompariPrediction[] = predictions.map((p) => {
    // 確定値は上書きしない。pending かつ確定済みのときだけ hit/miss を算出
    let computedOutcome = p.outcome;
    if (p.outcome === "pending" && isFinished) {
      computedOutcome = p.main?.trim() === winner ? "hit" : "miss";
    }
    return {
      ...p,
      outcome: computedOutcome,
    };
  });

  return {
    id: doc.id,
    category: doc.category,
    title: doc.title,
    candidates: doc.candidates,
    startsAt: doc.startsAt,
    participants: [],
    predictions: normalizedPredictions,
    result: doc.result,
    venue: doc.venue ?? "",
    startsIn: "",
    resultWinner: doc.result?.winner ?? "",
    createdAt: doc.createdAt,
  };
}

export function normalizeRaceToEvent(race: LegacyRaceData): KompariEvent {
  const winner = (race.result?.winner || race.resultWinner || "").trim();
  const isFinished = !!winner;
  const predictions = (race.predictions || []).map((p) => {
    const computedOutcome = !isFinished
      ? "pending"
      : p.main?.trim() === winner
        ? "hit"
        : "miss";
    return {
      ...p,
      outcome: p.outcome ?? computedOutcome,
    };
  });

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

// ランキング集計の分母に入れてよい予測かを判定する。
// 明示的に mock と分かるものだけ除外する。
// isMock/predictionSource が missing(undefined)の旧公式AIデータは除外しない。
// source filter（My AI除外）は別軸なので、この helper には含めない。
export function isCountablePrediction(prediction: KompariPrediction): boolean {
  if (prediction.isMock === true) return false;
  if (prediction.predictionSource === "mock") return false;

  const pick = (prediction.main || "").trim();
  if (!pick) return false;

  // 将来: status が "failed" | "skipped" | "omitted" の場合も除外する。
  // 現時点では status 未導入のため未実装。
  return true;
}

export type PredictionStatus = "hit" | "miss" | "pending";

// 表示用の3値判定。
// 結果未確定なら pending、結果確定済みなら hit / miss を返す。
// Pattern A 動的計算を維持する。
// prediction.main と resultWinner は保存時点で trim 済みだが、
// helper 単体の安全性のため両側 trim で対称にする。
// mock / main空 の除外は行わない。
// ranking 分母用の isCountablePrediction() とは別役割。
export function getPredictionStatus(
  prediction: KompariPrediction,
  resultWinner: string
): PredictionStatus {
  const pick = (prediction.main || "").trim();
  const winner = (resultWinner || "").trim();

  if (!winner) return "pending";
  if (pick === winner) return "hit";
  return "miss";
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