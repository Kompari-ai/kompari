// Client-safe official AI name/order source.
// Keep in sync with AI_CONFIGS displayName in lib/ai/ai-config.ts.
// Do NOT import ai-config.ts here: it contains server/API env configuration
// (process.env, API keys, baseUrl) that must not enter the client bundle.

export const OFFICIAL_AI_NAMES = [
  "ChatGPT",
  "Claude",
  "Gemini",
  "DeepSeek",
  "Grok",
] as const;

export type OfficialAiName = (typeof OFFICIAL_AI_NAMES)[number];

// Internal implementation. Do not export this Set.
// Official AI judgment must go through isOfficialAiName().
const OFFICIAL_AI_NAME_SET: ReadonlySet<string> = new Set(OFFICIAL_AI_NAMES);

export function isOfficialAiName(
  aiName: string | null | undefined
): aiName is OfficialAiName {
  return typeof aiName === "string" && OFFICIAL_AI_NAME_SET.has(aiName);
}
