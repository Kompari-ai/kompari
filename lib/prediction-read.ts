import type { PredictionShapeDiagnostic } from "@/lib/prediction-diagnostics";
import { isNonBlankString, type ParsedPredictionDocV1 } from "@/lib/events";

export type ParsePredictionDocContext = {
  eventId: string;
  predictionId: string;
  aiName?: string;
};

export type ParsePredictionDocResult =
  | { ok: true; value: ParsedPredictionDocV1 }
  | { ok: false; diagnostic: PredictionShapeDiagnostic };

export type RawPredictionDocInput = {
  raw: unknown;
  context: ParsePredictionDocContext;
};

export type ParsePredictionBatchResult = {
  validPredictions: ParsedPredictionDocV1[];
  shapeDiagnostics: PredictionShapeDiagnostic[];
};

type KnownPredictionSource =
  | "official-ai"
  | "my-ai"
  | "custom-ai"
  | "mock"
  | "manual";

function isKnownPredictionSource(value: string): value is KnownPredictionSource {
  return (
    value === "official-ai" ||
    value === "my-ai" ||
    value === "custom-ai" ||
    value === "mock" ||
    value === "manual"
  );
}

// 生値の安全な要約のみを返す。生内容・実値は一切含めない。
function summarizeUnknownValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `string(length=${value.length})`;
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return `array(length=${value.length})`;
  if (typeof value === "object") return "object";
  return typeof value;
}

function isPlainObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Firestoreに実在するprediction docのraw値をshape validationのみ行い、安全に型化する。
// source/mock/official/user分類は一切行わない(classifyPredictionSourceForDiagnosticsの責務)。
export function parsePredictionDoc(
  raw: unknown,
  context: ParsePredictionDocContext
): ParsePredictionDocResult {
  const base = {
    kind: "runtime-shape-anomaly" as const,
    eventId: context.eventId,
    predictionId: context.predictionId,
    contextAiName: context.aiName,
    isReviewRequired: true as const,
  };

  // raw自体がnull/array/primitiveの場合、フィールドへ安全にアクセスできない。
  // 完成型への型偽装(as KompariPredictionDoc等)は行わず、main欠損として扱う。
  if (!isPlainObjectLike(raw)) {
    return {
      ok: false,
      diagnostic: {
        ...base,
        field: "main",
        reason: "main-missing",
        rawValueSummary: summarizeUnknownValue(raw),
      },
    };
  }

  const rawMain = raw.main;
  if (rawMain === undefined) {
    return {
      ok: false,
      diagnostic: {
        ...base,
        field: "main",
        reason: "main-missing",
        rawValueSummary: summarizeUnknownValue(rawMain),
      },
    };
  }
  if (typeof rawMain !== "string") {
    return {
      ok: false,
      diagnostic: {
        ...base,
        field: "main",
        reason: "main-non-string",
        rawValueSummary: summarizeUnknownValue(rawMain),
      },
    };
  }
  if (!isNonBlankString(rawMain)) {
    return {
      ok: false,
      diagnostic: {
        ...base,
        field: "main",
        reason: "main-blank",
        rawValueSummary: summarizeUnknownValue(rawMain),
      },
    };
  }

  const rawAi = raw.ai;
  if (rawAi === undefined) {
    return {
      ok: false,
      diagnostic: {
        ...base,
        field: "ai",
        reason: "ai-missing",
        rawValueSummary: summarizeUnknownValue(rawAi),
      },
    };
  }
  if (typeof rawAi !== "string") {
    return {
      ok: false,
      diagnostic: {
        ...base,
        field: "ai",
        reason: "ai-non-string",
        rawValueSummary: summarizeUnknownValue(rawAi),
      },
    };
  }
  if (!isNonBlankString(rawAi)) {
    return {
      ok: false,
      diagnostic: {
        ...base,
        field: "ai",
        reason: "ai-blank",
        rawValueSummary: summarizeUnknownValue(rawAi),
      },
    };
  }

  // isMock: 未設定は許容。存在する場合のみboolean検証。
  const rawIsMock = raw.isMock;
  if (rawIsMock !== undefined && typeof rawIsMock !== "boolean") {
    return {
      ok: false,
      diagnostic: {
        ...base,
        field: "isMock",
        reason: "isMock-non-boolean",
        rawValueSummary: summarizeUnknownValue(rawIsMock),
      },
    };
  }

  // predictionSource: 未設定は許容。存在する場合のみ既知enum検証。
  const rawPredictionSource = raw.predictionSource;
  if (
    rawPredictionSource !== undefined &&
    (typeof rawPredictionSource !== "string" ||
      !isKnownPredictionSource(rawPredictionSource))
  ) {
    return {
      ok: false,
      diagnostic: {
        ...base,
        field: "predictionSource",
        reason: "predictionSource-invalid",
        rawValueSummary: summarizeUnknownValue(rawPredictionSource),
      },
    };
  }

  // isMock/predictionSourceの整合性。両方存在する場合のみ判定する。
  // 未設定フィールドを補完したり、推測して矛盾扱いしない。
  if (rawIsMock !== undefined && rawPredictionSource !== undefined) {
    const conflict =
      (rawIsMock === true && rawPredictionSource !== "mock") ||
      (rawIsMock === false && rawPredictionSource === "mock");

    if (conflict) {
      return {
        ok: false,
        diagnostic: {
          ...base,
          field: "predictionSource",
          reason: "mock-source-conflict",
          rawValueSummary: `isMock:${summarizeUnknownValue(rawIsMock)},predictionSource:${summarizeUnknownValue(rawPredictionSource)}`,
        },
      };
    }
  }

  const value: ParsedPredictionDocV1 = {
    main: rawMain,
    ai: rawAi,
    ...(rawIsMock !== undefined ? { isMock: rawIsMock } : {}),
    ...(rawPredictionSource !== undefined
      ? { predictionSource: rawPredictionSource }
      : {}),
    // source/myAiIdはP6-3 v1では未検証。classifier側が型ガードして読むため、
    // unknownのまま透過する(値の正しさをここでは一切主張しない)。
    source: raw.source,
    myAiId: raw.myAiId,
  };

  return { ok: true, value };
}

export function parsePredictionBatch(
  inputs: RawPredictionDocInput[]
): ParsePredictionBatchResult {
  const validPredictions: ParsedPredictionDocV1[] = [];
  const shapeDiagnostics: PredictionShapeDiagnostic[] = [];

  for (const input of inputs) {
    const result = parsePredictionDoc(input.raw, input.context);

    if (result.ok) {
      validPredictions.push(result.value);
    } else {
      shapeDiagnostics.push(result.diagnostic);
    }
  }

  return { validPredictions, shapeDiagnostics };
}
