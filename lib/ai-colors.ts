export type AiColorSet = {
  bg: string;
  text: string;
  border: string;
  bgLight: string;
  textDark: string;
};

const AI_COLOR_MAP: Record<string, AiColorSet> = {
  ChatGPT: {
    bg: "#10A37F",
    text: "#ffffff",
    border: "#10A37F",
    bgLight: "#d1fae5",
    textDark: "#065f46",
  },
  Claude: {
    bg: "#D97757",
    text: "#ffffff",
    border: "#D97757",
    bgLight: "#ffedd5",
    textDark: "#9a3412",
  },
  Gemini: {
    bg: "#4285F4",
    text: "#ffffff",
    border: "#4285F4",
    bgLight: "#dbeafe",
    textDark: "#1e40af",
  },
  DeepSeek: {
    bg: "#4D6BFE",
    text: "#ffffff",
    border: "#4D6BFE",
    bgLight: "#e0e7ff",
    textDark: "#3730a3",
  },
};

const FALLBACK_COLORS: AiColorSet = {
  bg: "#6366f1",
  text: "#ffffff",
  border: "#6366f1",
  bgLight: "#ede9fe",
  textDark: "#4c1d95",
};

export function getAiColors(aiName: string): AiColorSet {
  return AI_COLOR_MAP[aiName] ?? FALLBACK_COLORS;
}

export function getAiInitial(aiName: string): string {
  if (aiName === "ChatGPT") return "G";
  if (aiName === "Claude") return "C";
  if (aiName === "Gemini") return "✦";
  if (aiName === "DeepSeek") return "D";
  return aiName.slice(0, 1).toUpperCase();
}
