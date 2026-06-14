export type AiProviderKind = "openai-compatible" | "anthropic" | "gemini";

export type AiConfig = {
  key: string;
  displayName: string;
  provider: string;
  providerKind: AiProviderKind;
  model: string;
  prodModelId: string;
  devModelId: string;
  // openai-compatible のみ
  baseUrl?: string;
  apiKeyEnv: string;
};

export const AI_CONFIGS: AiConfig[] = [
  {
    key: "chatgpt",
    displayName: "ChatGPT",
    provider: "openai",
    providerKind: "openai-compatible",
    model: "GPT-5.5",
    prodModelId: "gpt-5.5",
    devModelId: "gpt-5.4-mini",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
  },
  {
    key: "claude",
    displayName: "Claude",
    provider: "anthropic",
    providerKind: "anthropic",
    model: "Claude Opus 4.8",
    prodModelId: "claude-opus-4-8",
    devModelId: "claude-haiku-4-5-20251001",
    apiKeyEnv: "ANTHROPIC_API_KEY",
  },
  {
    key: "gemini",
    displayName: "Gemini",
    provider: "google",
    providerKind: "gemini",
    model: "Gemini 2.5 Pro",
    prodModelId: "gemini-2.5-pro",
    devModelId: "gemini-2.5-flash",
    apiKeyEnv: "GEMINI_API_KEY",
  },
  {
    key: "deepseek",
    displayName: "DeepSeek",
    provider: "deepseek",
    providerKind: "openai-compatible",
    model: "DeepSeek V4 Pro",
    prodModelId: "deepseek-v4-pro",
    devModelId: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY",
  },
  {
    key: "grok",
    displayName: "Grok",
    provider: "xai",
    providerKind: "openai-compatible",
    model: "Grok 4.3",
    prodModelId: "grok-4.3",
    devModelId: "grok-4.3",
    baseUrl: "https://api.x.ai/v1",
    apiKeyEnv: "XAI_API_KEY",
  },
];

export function resolveModelId(config: AiConfig): string {
  const tier = process.env.AI_MODEL_TIER ?? "dev";
  return tier === "prod" ? config.prodModelId : config.devModelId;
}

// Static object literal: each process.env.X is resolved at build time.
// Dynamic access (process.env[varName]) is NOT inlined in production builds.
const ENV_KEY_MAP: Record<string, string | undefined> = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  XAI_API_KEY: process.env.XAI_API_KEY,
};

export function resolveApiKey(apiKeyEnv: string): string {
  return ENV_KEY_MAP[apiKeyEnv] ?? "";
}

export function getAiConfigByDisplayName(name: string): AiConfig | undefined {
  return AI_CONFIGS.find((c) => c.displayName === name);
}

export function getAiConfigByKey(key: string): AiConfig | undefined {
  return AI_CONFIGS.find((c) => c.key === key);
}
