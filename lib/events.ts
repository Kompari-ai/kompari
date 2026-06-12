import type { EventCategory } from "@/lib/categories";

export type KompariPrediction = {
  ai: string;
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