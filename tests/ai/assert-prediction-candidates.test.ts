import { expect, test } from "vitest";
import {
  assertPredictionCandidates,
  GeneratePredictionResponseSchema,
  type GeneratePredictionResponse,
} from "@/lib/ai/generate-prediction-schema";

// Assertion policy:
// - throwするケースは Error であること、field名を含むこと、
//   問題値を引用符付きで含むことだけを固定する。
// - メッセージ全文・句読点・語順は固定しない。
//   文言だけの変更でテストが壊れないようにするため。
// - assertPredictionCandidates直前のsource commentが主張する契約を、
//   実行される保証へ変換することが目的。

const baseResponse = (): GeneratePredictionResponse => ({
  ai: "テストAI",
  main: "候補A",
  predictionSource: "mock",
  isMock: true,
});

test("accepts a main that exactly matches a candidate", () => {
  const data = baseResponse();

  expect(() =>
    assertPredictionCandidates(data, ["候補A", "候補B"])
  ).not.toThrow();
});

test("throws when main is not in the candidate set", () => {
  const data = { ...baseResponse(), main: "候補X" };

  expect(() => assertPredictionCandidates(data, ["候補A"])).toThrow(Error);
  expect(() => assertPredictionCandidates(data, ["候補A"])).toThrow("main");
  expect(() => assertPredictionCandidates(data, ["候補A"])).toThrow('"候補X"');
});

test("throws on main when the candidate set is empty", () => {
  const data = baseResponse();

  expect(() => assertPredictionCandidates(data, [])).toThrow(Error);
  expect(() => assertPredictionCandidates(data, [])).toThrow("main");
  expect(() => assertPredictionCandidates(data, [])).toThrow('"候補A"');
});

test("skips the second check when second is absent", () => {
  const data = baseResponse();

  expect(() => assertPredictionCandidates(data, ["候補A"])).not.toThrow();
});

test("accepts a second that exactly matches a candidate", () => {
  const data = { ...baseResponse(), second: "候補B" };

  expect(() =>
    assertPredictionCandidates(data, ["候補A", "候補B"])
  ).not.toThrow();
});

test("throws when second is not in the candidate set", () => {
  const data = { ...baseResponse(), second: "候補X" };

  expect(() => assertPredictionCandidates(data, ["候補A"])).toThrow(Error);
  expect(() => assertPredictionCandidates(data, ["候補A"])).toThrow("second");
  expect(() => assertPredictionCandidates(data, ["候補A"])).toThrow('"候補X"');
});

test("skips the third check when third is absent", () => {
  const data = { ...baseResponse(), second: "候補B" };

  expect(() =>
    assertPredictionCandidates(data, ["候補A", "候補B"])
  ).not.toThrow();
});

test("accepts a third that exactly matches a candidate", () => {
  const data = { ...baseResponse(), second: "候補B", third: "候補C" };

  expect(() =>
    assertPredictionCandidates(data, ["候補A", "候補B", "候補C"])
  ).not.toThrow();
});

test("throws when third is not in the candidate set", () => {
  const data = { ...baseResponse(), third: "候補X" };

  expect(() => assertPredictionCandidates(data, ["候補A"])).toThrow(Error);
  expect(() => assertPredictionCandidates(data, ["候補A"])).toThrow("third");
  expect(() => assertPredictionCandidates(data, ["候補A"])).toThrow('"候補X"');
});

test("does not trim surrounding whitespace before matching", () => {
  const data = { ...baseResponse(), main: " 候補A " };

  expect(() => assertPredictionCandidates(data, ["候補A"])).toThrow(Error);
  expect(() => assertPredictionCandidates(data, ["候補A"])).toThrow("main");
  expect(() => assertPredictionCandidates(data, ["候補A"])).toThrow('" 候補A "');
});

test("does not accept a partial match", () => {
  const data = { ...baseResponse(), main: "候補" };

  expect(() => assertPredictionCandidates(data, ["候補A"])).toThrow(Error);
  expect(() => assertPredictionCandidates(data, ["候補A"])).toThrow("main");
  expect(() => assertPredictionCandidates(data, ["候補A"])).toThrow('"候補"');
});

// 契約の継ぎ目:
// response schema は second: "" を accept するが、
// validator は undefined ではないため候補集合との一致を要求する。
test("rejects a blank second that the response schema accepts", () => {
  const payload = { ...baseResponse(), second: "" };

  const parsed = GeneratePredictionResponseSchema.safeParse(payload);

  expect(parsed.success).toBe(true);
  if (!parsed.success) return;

  expect(() =>
    assertPredictionCandidates(parsed.data, ["候補A"])
  ).toThrow(Error);
  expect(() =>
    assertPredictionCandidates(parsed.data, ["候補A"])
  ).toThrow("second");
  expect(() =>
    assertPredictionCandidates(parsed.data, ["候補A"])
  ).toThrow('""');
});
