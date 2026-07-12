import { z } from "zod";

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
