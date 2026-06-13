import Anthropic from "@anthropic-ai/sdk";
import type { AiConfig } from "@/lib/ai/ai-config";
import { resolveModelId } from "@/lib/ai/ai-config";
import { buildPredictionPrompt } from "@/lib/ai/prompt";
import { parsePredictionOutput } from "@/lib/ai/parse";
import type { PredictionInput, PredictionOutput } from "@/lib/ai/types";

export async function callAnthropic(
  config: AiConfig,
  input: PredictionInput
): Promise<PredictionOutput> {
  const apiKey = process.env[config.apiKeyEnv] ?? "";
  const modelId = resolveModelId(config);
  const { system, user } = buildPredictionPrompt(input);

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: modelId,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: user }],
  });

  const block = message.content[0];
  const raw = block?.type === "text" ? block.text : "{}";
  return parsePredictionOutput(raw, input.candidates);
}
