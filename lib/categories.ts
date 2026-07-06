export type EventCategory =
  | "horse_racing"
  | "nba"
  | "soccer"
  | "mlb"
  | "crypto"
  | "stocks"
  | "election"
  | "esports";

export const eventCategories: {
  value: EventCategory;
  label: string;
  shortLabel: string;
  emoji: string;
}[] = [
  {
    value: "horse_racing",
    label: "Horse Racing / 競馬",
    shortLabel: "競馬",
    emoji: "🐎",
  },
  {
    value: "nba",
    label: "NBA",
    shortLabel: "NBA",
    emoji: "🏀",
  },
  {
    value: "soccer",
    label: "Soccer / サッカー",
    shortLabel: "サッカー",
    emoji: "⚽",
  },
  {
    value: "mlb",
    label: "MLB",
    shortLabel: "MLB",
    emoji: "⚾",
  },
  {
    value: "crypto",
    label: "Crypto",
    shortLabel: "Crypto",
    emoji: "₿",
  },
  {
    value: "stocks",
    label: "Stocks",
    shortLabel: "Stocks",
    emoji: "📈",
  },
  {
    value: "election",
    label: "Election",
    shortLabel: "Election",
    emoji: "🗳️",
  },
  {
    value: "esports",
    label: "Esports",
    shortLabel: "Esports",
    emoji: "🎮",
  },
];

export function getCategoryLabel(category?: string) {
  return (
    eventCategories.find((item) => item.value === category)?.shortLabel ||
    "競馬"
  );
}

export function getCategoryEmoji(category?: string) {
  return (
    eventCategories.find((item) => item.value === category)?.emoji || "🐎"
  );
}

// 公開ページ向けの実装済みカテゴリのみの派生配列。
// eventCategories 本体・EventCategory 型・admin のカテゴリ選択肢は変更しない。
// 将来カテゴリを解禁する際は、このフィルタ条件を広げるだけでよい。
export const publicEventCategories = eventCategories.filter(
  (category) => category.value === "horse_racing"
);