import type { PredictionFactor } from "@/lib/factors";

export type PredictionInput = {
  title: string;
  category: string;
  candidates: string[];
  aiDisplayName: string;
};

export type PredictionOutput = {
  main: string;
  second?: string;
  third?: string;
  confidence?: string;
  reason?: string;
  evidence?: string;
  usedFactors?: PredictionFactor[];
  factorKeys?: string[];
};

// ===== PR-3: prediction provenance =====
//
// これらの型はJSON parse後のparsed.mainが、候補集合との突合・fallback適用前に
// どのようなraw値だったかを表す契約である。canonical mainそのものではない。
// PR-3aで型契約を追加し、PR-3b-2でprovenance-aware parser wrapperへ接続、
// PR-3cでreal provider adapter・route response validation・client validation・
// Firestore保存へ接続した。read parser・diagnostics・UI表示は未接続。

// JSON parse後のparsed.mainのraw値契約。
// stringだった場合だけproviderRawMainを保持する(providers document がpublic readのため、
// object/array等の中身をそのまま保存しない。String(value)による強制文字列化も行わない)。
export type RawMainProvenance =
  | {
      rawMainType: "string";
      providerRawMain: string;
    }
  | {
      rawMainType:
        | "missing"
        | "null"
        | "number"
        | "boolean"
        | "array"
        | "object"
        | "unavailable";
    };

// 1回のprovider呼出し(attempt)についての、main決定プロセスの事実契約。
// 許可された組合せだけを表す判別可能unionとし、矛盾した組合せ
// (例: semanticStatus:"canonical"なのにfallbackReasonがある等)を型上作れないようにする。
export type PredictionAttemptProvenance =
  | {
      parseStatus: "json-parse-failed";
      semanticStatus: "semantic-fallback";
      fallbackReason: "json-parse-failed";
      rawMainType: "unavailable";
    }
  | {
      parseStatus: "parsed";
      semanticStatus: "canonical";
      rawMainType: "string";
      providerRawMain: string;
    }
  | {
      parseStatus: "parsed";
      semanticStatus: "semantic-fallback";
      fallbackReason: "main-missing";
      rawMainType: "missing";
    }
  | {
      parseStatus: "parsed";
      semanticStatus: "semantic-fallback";
      fallbackReason: "main-non-string";
      rawMainType: "null" | "number" | "boolean" | "array" | "object";
    }
  | {
      parseStatus: "parsed";
      semanticStatus: "semantic-fallback";
      fallbackReason: "main-blank";
      rawMainType: "string";
      providerRawMain: string;
    }
  | {
      parseStatus: "parsed";
      semanticStatus: "semantic-fallback";
      fallbackReason: "main-not-in-candidates";
      rawMainType: "string";
      providerRawMain: string;
    };

// retry発火時、初回attemptで欠損していたfieldの契約。現在の実経路でretryを発火し得る
// のはreason/evidenceのみ(mainはparsePredictionOutputが必ず非空値へfallbackするため
// 到達不能。§N-1)。空配列・重複・順序違いを型上作れないtuple unionとする。
// 順序は現在の欠損検査順(reason→evidence)に固定する。
export type InitialMissingFields =
  | ["reason"]
  | ["evidence"]
  | ["reason", "evidence"];

// 1回の生成リクエスト全体のprovenance契約。attempt countを判別軸とし、
// count:1ではinitial関連fieldを一切持たせず、count:2ではinitialAttempt/
// initialMissingFieldsを必須にする。retryApplied/mockFallbackApplied/
// providerCallStatusはgenerationAttemptCountや既存isMock/predictionSourceから
// 導出可能な値のため、別軸として追加しない(二重SoT回避)。
export type GenerationProvenance =
  | {
      version: 1;
      generationAttemptCount: 1;
      finalAttempt: PredictionAttemptProvenance;
    }
  | {
      version: 1;
      generationAttemptCount: 2;
      initialMissingFields: InitialMissingFields;
      initialAttempt: PredictionAttemptProvenance;
      finalAttempt: PredictionAttemptProvenance;
    };

// ===== PR-3b-2: parsePredictionOutputWithProvenance の戻り値契約 =====
//
// PredictionOutputそのものへのfield追加ではない。既存PredictionOutputの構造は
// 一切変更せず、output(既存契約)とattemptProvenance(main決定の事実契約)を
// 並べて返すための、独立した新しいexport型である。
export type ParsedPredictionOutputWithProvenance = {
  output: PredictionOutput;
  attemptProvenance: PredictionAttemptProvenance;
};
