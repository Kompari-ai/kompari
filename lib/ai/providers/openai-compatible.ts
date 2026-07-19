import OpenAI from "openai";
import type { AiConfig } from "@/lib/ai/ai-config";
import { resolveModelId, resolveApiKey } from "@/lib/ai/ai-config";
import { buildPredictionPrompt } from "@/lib/ai/prompt";
import { parsePredictionOutputWithProvenance } from "@/lib/ai/parse";
import type {
  ParsedPredictionOutputWithProvenance,
  PredictionInput,
} from "@/lib/ai/types";

export async function callOpenAiCompatible(
  config: AiConfig,
  input: PredictionInput
): Promise<ParsedPredictionOutputWithProvenance> {
  const apiKey = resolveApiKey(config.apiKeyEnv);
  const modelId = resolveModelId(config);
  const { system, user } = buildPredictionPrompt(input);

  const client = new OpenAI({
    apiKey,
    baseURL: config.baseUrl,
    timeout: 30000,
  });

  const response = await client.chat.completions.create({
    model: modelId,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return parsePredictionOutputWithProvenance(raw, input.candidates, input.category);
}
