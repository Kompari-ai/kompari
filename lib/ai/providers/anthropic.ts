import Anthropic from "@anthropic-ai/sdk";
import type { AiConfig } from "@/lib/ai/ai-config";
import { resolveModelId, resolveApiKey } from "@/lib/ai/ai-config";
import { buildPredictionPrompt } from "@/lib/ai/prompt";
import { parsePredictionOutputWithProvenance } from "@/lib/ai/parse";
import type {
  ParsedPredictionOutputWithProvenance,
  PredictionInput,
} from "@/lib/ai/types";

export async function callAnthropic(
  config: AiConfig,
  input: PredictionInput
): Promise<ParsedPredictionOutputWithProvenance> {
  const apiKey = resolveApiKey(config.apiKeyEnv);
  const modelId = resolveModelId(config);
  const { system, user } = buildPredictionPrompt(input);

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: modelId,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: user }],
  });

  const raw = message.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("");

  // Claude sometimes wraps JSON in code fences despite prompt instructions
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();

  return parsePredictionOutputWithProvenance(cleaned || "{}", input.candidates, input.category);
}
