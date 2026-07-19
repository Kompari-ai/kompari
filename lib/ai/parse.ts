import type {
  ParsedPredictionOutputWithProvenance,
  PredictionAttemptProvenance,
  PredictionOutput,
} from "./types";
import {
  type PredictionFactor,
  isCustomFactorKey,
  isValidFactorKey,
  getFactorKeysForCategory,
} from "@/lib/factors";

// PR-3b-1: pickCandidateの内部判定結果契約(module-private、未export)。
// PredictionAttemptProvenance/GenerationProvenanceへは未接続(この値はここでは消費しない)。
type CandidateNonStringRawType =
  | "null"
  | "number"
  | "boolean"
  | "array"
  | "object";

type CandidatePickResult =
  | {
      value: string;
      rawType: "string";
    }
  | {
      value: undefined;
      reason: "missing";
      rawType: "missing";
    }
  | {
      value: undefined;
      reason: "non-string";
      rawType: CandidateNonStringRawType;
    }
  | {
      value: undefined;
      reason: "blank";
      rawType: "string";
      providerRawMain: string;
    }
  | {
      value: undefined;
      reason: "not-in-candidates";
      rawType: "string";
      providerRawMain: string;
    };

// PR-3b-2: parsePredictionOutputCoreの戻り値契約(module-private、未export)。
// parseSucceeded:falseのbranchはmainPickを持たない。JSON parse失敗時に
// mainPickへ誤ってアクセスすることを型レベルで防ぐ(main-missingとの二重記録を防ぐ)。
type ParsedPredictionCoreResult =
  | {
      parseSucceeded: false;
      output: PredictionOutput;
    }
  | {
      parseSucceeded: true;
      output: PredictionOutput;
      mainPick: CandidatePickResult;
    };

// PR-3b-2: 既存parsePredictionOutputの本体をここへ移した共有core。
// JSON.parseはここで1回だけ行う。provenance objectはここでは構築しない
// (buildAttemptProvenanceの責務)。secondPick/thirdPickはoutput決定にのみ使い、
// core resultへは含めない(PredictionAttemptProvenanceはmain決定のみを対象とするため)。
function parsePredictionOutputCore(
  raw: string,
  candidates: string[],
  category?: string
): ParsedPredictionCoreResult {
  let parsed: Record<string, unknown> = {};
  let parseSucceeded = false;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
    parseSucceeded = true;
  } catch {
    // fall through with empty object
  }

  const pickCandidate = (v: unknown): CandidatePickResult => {
    if (v === undefined) {
      return { value: undefined, reason: "missing", rawType: "missing" };
    }

    if (typeof v !== "string") {
      let rawType: CandidateNonStringRawType;
      if (v === null) {
        rawType = "null";
      } else if (Array.isArray(v)) {
        rawType = "array";
      } else if (typeof v === "number") {
        rawType = "number";
      } else if (typeof v === "boolean") {
        rawType = "boolean";
      } else {
        rawType = "object";
      }
      return { value: undefined, reason: "non-string", rawType };
    }

    if (candidates.includes(v)) {
      return { value: v, rawType: "string" };
    }

    if (v.trim() === "") {
      return {
        value: undefined,
        reason: "blank",
        rawType: "string",
        providerRawMain: v,
      };
    }

    return {
      value: undefined,
      reason: "not-in-candidates",
      rawType: "string",
      providerRawMain: v,
    };
  };

  const mainPick = pickCandidate(parsed.main);
  const secondPick = pickCandidate(parsed.second);
  const thirdPick = pickCandidate(parsed.third);

  const main = mainPick.value ?? candidates[0] ?? "未定";
  const second = secondPick.value ?? candidates[1];
  const third = thirdPick.value ?? candidates[2];
  const confidence =
    typeof parsed.confidence === "string" ? parsed.confidence : undefined;
  const reason =
    typeof parsed.reason === "string" ? parsed.reason : undefined;
  const evidence =
    typeof parsed.evidence === "string" ? parsed.evidence : undefined;

  let usedFactors: PredictionFactor[] = [];
  let factorKeys: string[] = [];
  try {
    const extracted = extractUsedFactors(parsed, category);
    usedFactors = extracted.usedFactors;
    factorKeys = extracted.factorKeys;
  } catch {
    // factor extraction must never break the core prediction
  }

  const output: PredictionOutput = {
    main,
    second,
    third,
    confidence,
    reason,
    evidence,
  };
  if (usedFactors.length > 0) {
    output.usedFactors = usedFactors;
    output.factorKeys = factorKeys;
  }

  if (!parseSucceeded) {
    return {
      parseSucceeded: false,
      output,
    };
  }

  return {
    parseSucceeded: true,
    output,
    mainPick,
  };
}

// PR-3b-2: parsePredictionOutputCoreの結果からPredictionAttemptProvenanceを
// 組み立てる。既存本番経路(parsePredictionOutput)からは呼ばれない
// (parsePredictionOutputWithProvenance専用)。
function buildAttemptProvenance(
  core: ParsedPredictionCoreResult
): PredictionAttemptProvenance {
  if (!core.parseSucceeded) {
    return {
      parseStatus: "json-parse-failed",
      semanticStatus: "semantic-fallback",
      fallbackReason: "json-parse-failed",
      rawMainType: "unavailable",
    };
  }

  const { mainPick } = core;

  // truthinessではなくundefinedとの比較を使う。空文字列・空白文字列も
  // canonical候補になり得るため(candidates集合と完全一致していればcanonical)。
  if (mainPick.value !== undefined) {
    return {
      parseStatus: "parsed",
      semanticStatus: "canonical",
      rawMainType: "string",
      providerRawMain: mainPick.value,
    };
  }

  if (mainPick.reason === "missing") {
    return {
      parseStatus: "parsed",
      semanticStatus: "semantic-fallback",
      fallbackReason: "main-missing",
      rawMainType: "missing",
    };
  }

  if (mainPick.reason === "non-string") {
    return {
      parseStatus: "parsed",
      semanticStatus: "semantic-fallback",
      fallbackReason: "main-non-string",
      rawMainType: mainPick.rawType,
    };
  }

  if (mainPick.reason === "blank") {
    return {
      parseStatus: "parsed",
      semanticStatus: "semantic-fallback",
      fallbackReason: "main-blank",
      rawMainType: "string",
      providerRawMain: mainPick.providerRawMain,
    };
  }

  if (mainPick.reason === "not-in-candidates") {
    return {
      parseStatus: "parsed",
      semanticStatus: "semantic-fallback",
      fallbackReason: "main-not-in-candidates",
      rawMainType: "string",
      providerRawMain: mainPick.providerRawMain,
    };
  }

  const exhaustiveCheck: never = mainPick;
  throw new Error(
    `Unhandled CandidatePickResult: ${JSON.stringify(exhaustiveCheck)}`
  );
}

// PR-3b-2: 既存exportの互換wrapper。signature・戻り値とも無変更。
// provider adapterは引き続きこの関数を経由し、共有coreのoutputだけを受け取る。
export function parsePredictionOutput(
  raw: string,
  candidates: string[],
  category?: string
): PredictionOutput {
  return parsePredictionOutputCore(raw, candidates, category).output;
}

// PR-3b-2: 新規export。PR-3b-2時点では既存provider adapter/route/clientの
// いずれからも呼ばれない未配線の公開関数。
export function parsePredictionOutputWithProvenance(
  raw: string,
  candidates: string[],
  category?: string
): ParsedPredictionOutputWithProvenance {
  const core = parsePredictionOutputCore(raw, candidates, category);

  return {
    output: core.output,
    attemptProvenance: buildAttemptProvenance(core),
  };
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
