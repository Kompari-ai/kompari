import { z } from "zod";
import type {
  GenerationProvenance,
  InitialMissingFields,
  PredictionAttemptProvenance,
  RawMainProvenance,
} from "@/lib/ai/types";

// /api/generate-prediction の成功レスポンス用共有schema。
// route.ts(server, NextResponse.json直前)と app/admin/edit/[id]/page.tsx
// (client, response.json直後)の両境界から同一schemaを再利用する。
// server専用/client専用APIはimportしない(zodのみに依存する共有可能モジュール)。
//
// 対象はAPIレスポンスの構造契約のみ。KompariPrediction/KompariPredictionDoc/
// PredictionOutput/PredictionFactor自体はこのファイルではschema化しない
// (今回z.inferで型を導出する対象はGeneratePredictionResponseのみ)。

// 空文字列・空白のみの文字列を拒否する。値自体をtrimして書き換えることはしない。
const nonBlankString = z.string().refine(
  (value) => value.trim().length > 0,
  { message: "Must not be blank" }
);

// route.ts が実際に返す predictionSource は "official-ai" | "mock" の2値のみ
// (my-ai/custom-ai/manualは型定義上の予約値で、この生成APIからは返らない)。
const generatePredictionSourceSchema = z.enum(["official-ai", "mock"]);

// lib/factors.ts の PredictionFactor と構造互換になるよう定義する。
// PredictionFactor自体のschema駆動化は対象外のため、ここでは
// GeneratePredictionResponseの一部としてのみ使う。
const factorDirectionSchema = z.enum(["positive", "negative", "neutral"]);

const predictionFactorSchema = z.object({
  key: z.string(),
  label: z.string(),
  direction: factorDirectionSchema,
  note: z.string().optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  weight: z.number().optional(),
});

// ===== prediction provenance schemas =====
//
// PR-3aで独立schemaとして追加された。PR-3cでGenerationProvenanceSchemaだけを
// active response schema(GeneratePredictionResponseSchema)へ接続する。
// RawMainProvenanceSchema / PredictionAttemptProvenanceSchema /
// InitialMissingFieldsSchemaはGenerationProvenanceSchemaを通して間接的に
// 使用される(active schemaから直接参照されるのはGenerationProvenanceSchemaのみ)。
// active schemaより前に定義する: GenerationProvenanceSchemaはこの後で定義される
// GeneratePredictionResponseSchemaから参照されるため、前方参照(TDZ)を避ける。

const rawMainProvenanceStringBranch = z
  .object({
    rawMainType: z.literal("string"),
    // providerRawMainはJSON parse後・候補突合とfallback適用前のraw main文字列。
    // nonBlankStringは使わない: 空文字列・空白のみの文字列もproviderが実際に
    // 返した値であり、そのまま保持する契約とする(値をtrim・書き換えしない)。
    providerRawMain: z.string(),
  })
  .strict();

const rawMainProvenanceNonStringBranch = z
  .object({
    rawMainType: z.enum([
      "missing",
      "null",
      "number",
      "boolean",
      "array",
      "object",
      "unavailable",
    ]),
  })
  .strict();

export const RawMainProvenanceSchema: z.ZodType<RawMainProvenance> = z.union([
  rawMainProvenanceStringBranch,
  rawMainProvenanceNonStringBranch,
]);

// RawMainProvenanceSchemaとの単純なintersectionにはしない。attempt全体として
// 許可された6つの組合せだけを、それぞれstrict objectとして個別に表現する。
const predictionAttemptJsonParseFailedBranch = z
  .object({
    parseStatus: z.literal("json-parse-failed"),
    semanticStatus: z.literal("semantic-fallback"),
    fallbackReason: z.literal("json-parse-failed"),
    rawMainType: z.literal("unavailable"),
  })
  .strict();

const predictionAttemptCanonicalBranch = z
  .object({
    parseStatus: z.literal("parsed"),
    semanticStatus: z.literal("canonical"),
    rawMainType: z.literal("string"),
    providerRawMain: z.string(),
  })
  .strict();

const predictionAttemptMainMissingBranch = z
  .object({
    parseStatus: z.literal("parsed"),
    semanticStatus: z.literal("semantic-fallback"),
    fallbackReason: z.literal("main-missing"),
    rawMainType: z.literal("missing"),
  })
  .strict();

const predictionAttemptMainNonStringBranch = z
  .object({
    parseStatus: z.literal("parsed"),
    semanticStatus: z.literal("semantic-fallback"),
    fallbackReason: z.literal("main-non-string"),
    rawMainType: z.enum(["null", "number", "boolean", "array", "object"]),
  })
  .strict();

const predictionAttemptMainBlankBranch = z
  .object({
    parseStatus: z.literal("parsed"),
    semanticStatus: z.literal("semantic-fallback"),
    fallbackReason: z.literal("main-blank"),
    rawMainType: z.literal("string"),
    providerRawMain: z.string(),
  })
  .strict();

const predictionAttemptMainNotInCandidatesBranch = z
  .object({
    parseStatus: z.literal("parsed"),
    semanticStatus: z.literal("semantic-fallback"),
    fallbackReason: z.literal("main-not-in-candidates"),
    rawMainType: z.literal("string"),
    providerRawMain: z.string(),
  })
  .strict();

export const PredictionAttemptProvenanceSchema: z.ZodType<PredictionAttemptProvenance> =
  z.union([
    predictionAttemptJsonParseFailedBranch,
    predictionAttemptCanonicalBranch,
    predictionAttemptMainMissingBranch,
    predictionAttemptMainNonStringBranch,
    predictionAttemptMainBlankBranch,
    predictionAttemptMainNotInCandidatesBranch,
  ]);

// 空配列・重複・逆順(["evidence","reason"]等)を許容しないtuple union。
// 現在の欠損検査順(reason→evidence)に固定する。
export const InitialMissingFieldsSchema: z.ZodType<InitialMissingFields> =
  z.union([
    z.tuple([z.literal("reason")]),
    z.tuple([z.literal("evidence")]),
    z.tuple([z.literal("reason"), z.literal("evidence")]),
  ]);

const generationProvenanceCountOneBranch = z
  .object({
    version: z.literal(1),
    generationAttemptCount: z.literal(1),
    finalAttempt: PredictionAttemptProvenanceSchema,
  })
  .strict();

const generationProvenanceCountTwoBranch = z
  .object({
    version: z.literal(1),
    generationAttemptCount: z.literal(2),
    initialMissingFields: InitialMissingFieldsSchema,
    initialAttempt: PredictionAttemptProvenanceSchema,
    finalAttempt: PredictionAttemptProvenanceSchema,
  })
  .strict();

export const GenerationProvenanceSchema: z.ZodType<GenerationProvenance> =
  z.discriminatedUnion("generationAttemptCount", [
    generationProvenanceCountOneBranch,
    generationProvenanceCountTwoBranch,
  ]);

// 未知フィールドは.passthroughで保持する。検証成功後の利用は必ずparsed.dataとし、
// 元のinput objectは使わない(呼び出し側の責務)。
export const GeneratePredictionResponseSchema = z
  .object({
    ai: nonBlankString,
    main: nonBlankString,
    predictionSource: generatePredictionSourceSchema,
    isMock: z.boolean(),

    second: z.string().optional(),
    third: z.string().optional(),
    confidence: z.string().optional(),
    reason: z.string().optional(),
    evidence: z.string().optional(),
    aiProvider: z.string().optional(),
    aiModel: z.string().optional(),
    aiModelId: z.string().optional(),
    usedFactors: z.array(predictionFactorSchema).optional(),
    factorKeys: z.array(z.string()).optional(),

    generationProvenance: GenerationProvenanceSchema.optional(),

    // output / attemptProvenanceはprovider-parser内部wrapperのfield。
    // API success responseのtop-levelには存在してはいけない。
    // .passthrough()を維持する間も、この2つだけは明示的に拒否する。
    //
    // z.never().optional()の境界: object/null/string/number/array等の
    // JSONで表現可能な値は拒否する。JavaScript上のundefinedはoptional
    // semantics上許容され得るが、undefinedはJSONへ出ず、Firestore保存前にも
    // (removeUndefinedFieldsで)除去されるため、今回のwrapper漏洩防止対象ではない。
    output: z.never().optional(),
    attemptProvenance: z.never().optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    // predictionSource と isMock の対応を双方向に保証する。
    // official-ai + isMock:true、mock + isMock:false はいずれも矛盾データとして失敗させる。
    if (data.predictionSource === "mock" && data.isMock !== true) {
      ctx.addIssue({
        code: "custom",
        message: 'predictionSource "mock" requires isMock === true',
        path: ["isMock"],
      });
    }

    if (data.predictionSource === "official-ai" && data.isMock !== false) {
      ctx.addIssue({
        code: "custom",
        message: 'predictionSource "official-ai" requires isMock === false',
        path: ["isMock"],
      });
    }

    // predictionSource と generationProvenance の対応を双方向に保証する。
    // official-ai は実providerのattempt provenanceを必須とし、mockはcanonicalな
    // provider attemptとして偽装しないよう、generationProvenanceの付与を禁止する。
    if (
      data.predictionSource === "official-ai" &&
      data.generationProvenance === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          'predictionSource "official-ai" requires generationProvenance',
        path: ["generationProvenance"],
      });
    }

    if (
      data.predictionSource === "mock" &&
      data.generationProvenance !== undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          'predictionSource "mock" must not include generationProvenance',
        path: ["generationProvenance"],
      });
    }
  });

export type GeneratePredictionResponse = z.infer<
  typeof GeneratePredictionResponseSchema
>;

// 構造schemaとは別関数として、候補集合とのドメイン整合性を検証する。
// main/second/thirdは候補集合と完全一致する場合のみ許可する
// (trim・表記変換・部分一致・近似一致・先頭候補へのfallbackは行わない)。
// 候補集合が空の場合はmainを正当化できないため必ず失敗する。
export function assertPredictionCandidates(
  data: GeneratePredictionResponse,
  candidates: readonly string[]
): void {
  const candidateSet = new Set(candidates);

  if (!candidateSet.has(data.main)) {
    throw new Error(
      `main "${data.main}" is not in the candidate set`
    );
  }

  if (data.second !== undefined && !candidateSet.has(data.second)) {
    throw new Error(
      `second "${data.second}" is not in the candidate set`
    );
  }

  if (data.third !== undefined && !candidateSet.has(data.third)) {
    throw new Error(
      `third "${data.third}" is not in the candidate set`
    );
  }
}
