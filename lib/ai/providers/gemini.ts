// SDK: @google/genai (confirmed 2026-06 via ai.google.dev quickstart)
// Docs: https://ai.google.dev/gemini-api/docs/quickstart?lang=node
import { GoogleGenAI } from "@google/genai";
import type { AiConfig } from "@/lib/ai/ai-config";
import { resolveModelId } from "@/lib/ai/ai-config";
import { buildPredictionPrompt } from "@/lib/ai/prompt";
import { parsePredictionOutput } from "@/lib/ai/parse";
import type { PredictionInput, PredictionOutput } from "@/lib/ai/types";

export async function callGemini(
  config: AiConfig,
  input: PredictionInput
): Promise<PredictionOutput> {
  const apiKey = process.env[config.apiKeyEnv] ?? "";
  const modelId = resolveModelId(config);
  const { system, user } = buildPredictionPrompt(input);

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: modelId,
    contents: user,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
    },
  });

  const raw = response.text ?? "{}";
  return parsePredictionOutput(raw, input.candidates);
}
