import {
  getPredictionSource,
  type PredictionSourceKind,
} from "@/lib/stats";
import {
  isNonBlankString,
  type KompariPrediction,
  type ParsedPredictionDocV1,
} from "@/lib/events";

// --- Shape診断(parser専用。lib/prediction-read.tsが返す) ---

export type PredictionShapeReasonMain =
  | "main-missing"
  | "main-non-string"
  | "main-blank";

export type PredictionShapeReasonAi =
  | "ai-missing"
  | "ai-non-string"
  | "ai-blank";

export type PredictionShapeReasonMock = "isMock-non-boolean";

export type PredictionShapeReasonSource =
  | "predictionSource-invalid"
  | "mock-source-conflict";

type PredictionShapeDiagnosticBase = {
  kind: "runtime-shape-anomaly";
  eventId: string;
  predictionId: string;
  // raw doc自体のai値ではなく、呼び出し元が把握しているcontext由来の値。
  // raw docのaiは診断対象(非文字列/欠損の可能性がある)のため区別する。
  contextAiName?: string;
  isReviewRequired: true;
  rawValueSummary: string;
};

export type PredictionShapeDiagnostic =
  | (PredictionShapeDiagnosticBase & {
      field: "main";
      reason: PredictionShapeReasonMain;
    })
  | (PredictionShapeDiagnosticBase & {
      field: "ai";
      reason: PredictionShapeReasonAi;
    })
  | (PredictionShapeDiagnosticBase & {
      field: "isMock";
      reason: PredictionShapeReasonMock;
    })
  | (PredictionShapeDiagnosticBase & {
      field: "predictionSource";
      reason: PredictionShapeReasonSource;
    });

// --- Source診断(shape-validなdocをclassifierが分類) ---

export type PredictionSourceDiagnostic =
  | { kind: "official"; isReviewRequired: false }
  | { kind: "user"; isReviewRequired: false }
  | { kind: "mock"; isReviewRequired: false }
  | { kind: "unknown-source"; isReviewRequired: true };

// --- 旧5値互換型(P5-D v1) ---

export type PredictionDiagnosticClassification =
  | "runtime-shape-anomaly"
  | "mock"
  | "unknown-source"
  | "official"
  | "user";

// shape-valid入力専用のsource classifier。
// mainのshape検証は行わない(呼び出し元がparsePredictionDocで検証済みであることを前提とする)。
// source判定はgetPredictionSource(既存SoT、lib/stats.ts)へ委譲し、
// hasOfficialMarker/hasValidUserMarkerの条件をここへ複製しない。
export function classifyPredictionSourceForDiagnostics(
  input: ParsedPredictionDocV1
): PredictionSourceDiagnostic {
  if (input.isMock === true || input.predictionSource === "mock") {
    return { kind: "mock", isReviewRequired: false };
  }

  const source: PredictionSourceKind = getPredictionSource(input);

  if (source === "unknown") {
    return { kind: "unknown-source", isReviewRequired: true };
  }

  return { kind: source, isReviewRequired: false };
}

// 既存P5-Dの呼び出し元(app/admin/results/page.tsx)向け互換wrapper。
// 旧関数名・旧5値戻り値・旧判定順を維持する。
// P6-3ではadmin/resultsの既存挙動を維持するため、wrapperの責務を広げない
// (aiのshape guardを新規追加しない)。
//
// 判定順(P5-D v1と完全一致させる):
// 1. mainが非string/blank → runtime-shape-anomaly
// 2. isMock===true または predictionSource==="mock" → mock
// 3. getPredictionSource===unknown → unknown-source
// 4. official / user
export function classifyPredictionForDiagnostics(
  prediction: KompariPrediction
): PredictionDiagnosticClassification {
  if (!isNonBlankString(prediction.main)) {
    return "runtime-shape-anomaly";
  }

  const diagnostic = classifyPredictionSourceForDiagnostics(prediction);

  return diagnostic.kind;
}
