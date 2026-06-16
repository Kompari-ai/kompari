import type { EventCategory } from "./categories";

export type FactorDirection = "positive" | "negative" | "neutral";

export type PredictionFactor = {
  key: string;
  label: string;
  direction: FactorDirection;
  note?: string;
  value?: string | number | boolean;
  weight?: number;
};

export type SpecificFactorGroup = "horse_racing" | "sports" | "finance";

export const COMMON_FACTORS: Record<string, string> = {
  weather: "天候",
  news_sentiment: "ニュース材料",
  market_sentiment: "市場・世論の流れ",
  odds_movement: "オッズ・人気の動き",
  historical_record: "過去実績",
  data_uncertainty: "情報不足・不確実性",
  risk_event: "リスクイベント",
};

export const GROUP_FACTORS: Record<SpecificFactorGroup, Record<string, string>> = {
  horse_racing: {
    horse_form: "馬の近走成績",
    horse_condition: "馬体・仕上がり",
    jockey: "騎手",
    trainer: "調教師",
    track_condition: "馬場状態",
    distance_fit: "距離適性",
    course_fit: "コース適性",
    draw: "枠順",
    pace: "展開・ペース",
    weight_carried: "斤量",
    bloodline: "血統",
    odds_value: "妙味・過小評価",
  },
  sports: {
    team_form: "チームの直近調子",
    player_condition: "選手状態",
    injury: "怪我・欠場",
    home_advantage: "ホームアドバンテージ",
    head_to_head: "対戦成績",
    schedule_fatigue: "日程疲労",
    tactical_matchup: "戦術相性",
    motivation: "モチベーション",
  },
  finance: {
    macro_trend: "マクロ環境",
    technical_signal: "テクニカル指標",
    volume: "出来高・取引量",
    earnings: "決算",
    valuation: "割安・割高",
    regulation: "規制",
    liquidity: "流動性",
    risk_event: "リスクイベント",
  },
};

const EVENT_CATEGORY_TO_FACTOR_GROUP: Record<EventCategory, SpecificFactorGroup | null> = {
  horse_racing: "horse_racing",
  nba: "sports",
  soccer: "sports",
  mlb: "sports",
  esports: "sports",
  crypto: "finance",
  stocks: "finance",
  election: null,
};

export function isCustomFactorKey(key: string): boolean {
  return key.startsWith("custom:");
}

export function isStandardFactorKey(key: string): boolean {
  if (key in COMMON_FACTORS) return true;
  return Object.values(GROUP_FACTORS).some((group) => key in group);
}

export function isValidFactorKey(key: string): boolean {
  return isStandardFactorKey(key) || isCustomFactorKey(key);
}

export function getFactorLabel(key: string): string {
  if (key in COMMON_FACTORS) return COMMON_FACTORS[key];
  for (const group of Object.values(GROUP_FACTORS)) {
    if (key in group) return group[key];
  }
  if (isCustomFactorKey(key)) return key.slice("custom:".length);
  return key;
}

export function getFactorKeysForCategory(category: EventCategory | string): string[] {
  const commonKeys = Object.keys(COMMON_FACTORS);
  const group =
    category in EVENT_CATEGORY_TO_FACTOR_GROUP
      ? EVENT_CATEGORY_TO_FACTOR_GROUP[category as EventCategory]
      : null;
  const groupKeys = group ? Object.keys(GROUP_FACTORS[group]) : [];
  return Array.from(new Set([...commonKeys, ...groupKeys]));
}
