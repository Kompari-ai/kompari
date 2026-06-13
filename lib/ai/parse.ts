import type { PredictionOutput } from "./types";

export function parsePredictionOutput(
  raw: string,
  candidates: string[]
): PredictionOutput {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // fall through with empty object
  }

  const pickCandidate = (v: unknown): string | undefined => {
    if (typeof v === "string" && candidates.includes(v)) return v;
    return undefined;
  };

  const main = pickCandidate(parsed.main) ?? candidates[0] ?? "未定";
  const second = pickCandidate(parsed.second) ?? candidates[1];
  const third = pickCandidate(parsed.third) ?? candidates[2];
  const confidence =
    typeof parsed.confidence === "string" ? parsed.confidence : undefined;
  const reason =
    typeof parsed.reason === "string" ? parsed.reason : undefined;
  const evidence =
    typeof parsed.evidence === "string" ? parsed.evidence : undefined;

  return { main, second, third, confidence, reason, evidence };
}
