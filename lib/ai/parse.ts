import type { PredictionOutput } from "./types";
import {
  type PredictionFactor,
  isCustomFactorKey,
  isValidFactorKey,
  getFactorKeysForCategory,
} from "@/lib/factors";

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

const FACTOR_DIRECTIONS = new Set(["positive", "negative", "neutral"]);

function isAllowedFactorKey(key: string, category?: string): boolean {
  if (isCustomFactorKey(key)) return true;
  if (category === undefined) return isValidFactorKey(key);
  return getFactorKeysForCategory(category).includes(key);
}

function toPredictionFactor(
  item: unknown,
  category?: string
): PredictionFactor | undefined {
  if (typeof item !== "object" || item === null) return undefined;
  const raw = item as Record<string, unknown>;

  const key = raw.key;
  const label = raw.label;
  const direction = raw.direction;
  if (typeof key !== "string" || !isAllowedFactorKey(key, category)) {
    return undefined;
  }
  if (typeof label !== "string") return undefined;
  if (typeof direction !== "string" || !FACTOR_DIRECTIONS.has(direction)) {
    return undefined;
  }

  const factor: PredictionFactor = {
    key,
    label,
    direction: direction as PredictionFactor["direction"],
  };

  if (typeof raw.note === "string") factor.note = raw.note;
  if (
    typeof raw.value === "string" ||
    typeof raw.value === "number" ||
    typeof raw.value === "boolean"
  ) {
    factor.value = raw.value;
  }
  if (typeof raw.weight === "number") factor.weight = raw.weight;

  return factor;
}

export function extractUsedFactors(
  parsed: unknown,
  category?: string
): { usedFactors: PredictionFactor[]; factorKeys: string[] } {
  const empty = { usedFactors: [], factorKeys: [] };

  if (typeof parsed !== "object" || parsed === null) return empty;
  const candidateList = (parsed as Record<string, unknown>).usedFactors;
  if (!Array.isArray(candidateList)) return empty;

  const usedFactors: PredictionFactor[] = [];
  const factorKeys: string[] = [];
  const seenKeys = new Set<string>();

  for (const item of candidateList) {
    const factor = toPredictionFactor(item, category);
    if (!factor) continue;
    usedFactors.push(factor);
    if (!seenKeys.has(factor.key)) {
      seenKeys.add(factor.key);
      factorKeys.push(factor.key);
    }
  }

  return { usedFactors, factorKeys };
}
