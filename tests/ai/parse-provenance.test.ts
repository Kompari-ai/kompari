import { expect, test } from "vitest";
import { parsePredictionOutputWithProvenance } from "@/lib/ai/parse";
import type { PredictionAttemptProvenance } from "@/lib/ai/types";

test(
  "priority-1 json-parse-failed: invalid JSON yields unavailable raw main type",
  () => {
    const result = parsePredictionOutputWithProvenance(
      "not json at all",
      ["候補A", "候補B"]
    );

    const expected = {
      parseStatus: "json-parse-failed",
      semanticStatus: "semantic-fallback",
      fallbackReason: "json-parse-failed",
      rawMainType: "unavailable",
    } satisfies PredictionAttemptProvenance;

    expect(result.attemptProvenance).toStrictEqual(expected);
    expect(result.output.main).toBe("候補A");
  }
);

test(
  "priority-2 canonical: main matching a candidate keeps the provider value",
  () => {
    const result = parsePredictionOutputWithProvenance(
      JSON.stringify({ main: "候補A" }),
      ["候補A", "候補B"]
    );

    const expected = {
      parseStatus: "parsed",
      semanticStatus: "canonical",
      rawMainType: "string",
      providerRawMain: "候補A",
    } satisfies PredictionAttemptProvenance;

    expect(result.attemptProvenance).toStrictEqual(expected);
    expect(result.output.main).toBe("候補A");
  }
);

test(
  "priority-3 main-missing: absent main property yields missing raw main type",
  () => {
    const result = parsePredictionOutputWithProvenance(
      JSON.stringify({}),
      ["候補A", "候補B"]
    );

    const expected = {
      parseStatus: "parsed",
      semanticStatus: "semantic-fallback",
      fallbackReason: "main-missing",
      rawMainType: "missing",
    } satisfies PredictionAttemptProvenance;

    expect(result.attemptProvenance).toStrictEqual(expected);
    expect(result.output.main).toBe("候補A");
  }
);

test(
  "priority-4 main-non-string: null main is recorded as null raw main type",
  () => {
    const result = parsePredictionOutputWithProvenance(
      JSON.stringify({ main: null }),
      ["候補A", "候補B"]
    );

    const expected = {
      parseStatus: "parsed",
      semanticStatus: "semantic-fallback",
      fallbackReason: "main-non-string",
      rawMainType: "null",
    } satisfies PredictionAttemptProvenance;

    expect(result.attemptProvenance).toStrictEqual(expected);
    expect(result.output.main).toBe("候補A");
  }
);

test(
  "priority-4 main-non-string: number main is recorded as number raw main type",
  () => {
    const result = parsePredictionOutputWithProvenance(
      JSON.stringify({ main: 123 }),
      ["候補A", "候補B"]
    );

    const expected = {
      parseStatus: "parsed",
      semanticStatus: "semantic-fallback",
      fallbackReason: "main-non-string",
      rawMainType: "number",
    } satisfies PredictionAttemptProvenance;

    expect(result.attemptProvenance).toStrictEqual(expected);
    expect(result.output.main).toBe("候補A");
  }
);

test(
  "priority-4 main-non-string: boolean main is recorded as boolean raw main type",
  () => {
    const result = parsePredictionOutputWithProvenance(
      JSON.stringify({ main: true }),
      ["候補A", "候補B"]
    );

    const expected = {
      parseStatus: "parsed",
      semanticStatus: "semantic-fallback",
      fallbackReason: "main-non-string",
      rawMainType: "boolean",
    } satisfies PredictionAttemptProvenance;

    expect(result.attemptProvenance).toStrictEqual(expected);
    expect(result.output.main).toBe("候補A");
  }
);

test(
  "priority-4 main-non-string: array main is recorded as array raw main type",
  () => {
    const result = parsePredictionOutputWithProvenance(
      JSON.stringify({ main: ["候補A"] }),
      ["候補A", "候補B"]
    );

    const expected = {
      parseStatus: "parsed",
      semanticStatus: "semantic-fallback",
      fallbackReason: "main-non-string",
      rawMainType: "array",
    } satisfies PredictionAttemptProvenance;

    expect(result.attemptProvenance).toStrictEqual(expected);
    expect(result.output.main).toBe("候補A");
  }
);

test(
  "priority-4 main-non-string: object main is recorded as object raw main type",
  () => {
    const result = parsePredictionOutputWithProvenance(
      JSON.stringify({ main: { value: "候補A" } }),
      ["候補A", "候補B"]
    );

    const expected = {
      parseStatus: "parsed",
      semanticStatus: "semantic-fallback",
      fallbackReason: "main-non-string",
      rawMainType: "object",
    } satisfies PredictionAttemptProvenance;

    expect(result.attemptProvenance).toStrictEqual(expected);
    expect(result.output.main).toBe("候補A");
  }
);

test(
  "priority-5 main-blank: whitespace-only main not in candidates falls back",
  () => {
    const result = parsePredictionOutputWithProvenance(
      JSON.stringify({ main: "   " }),
      ["候補A", "候補B"]
    );

    const expected = {
      parseStatus: "parsed",
      semanticStatus: "semantic-fallback",
      fallbackReason: "main-blank",
      rawMainType: "string",
      providerRawMain: "   ",
    } satisfies PredictionAttemptProvenance;

    expect(result.attemptProvenance).toStrictEqual(expected);
    expect(result.output.main).toBe("候補A");
  }
);

test(
  "priority-6 main-not-in-candidates: unknown main falls back and keeps raw value",
  () => {
    const result = parsePredictionOutputWithProvenance(
      JSON.stringify({ main: "候補X" }),
      ["候補A", "候補B"]
    );

    const expected = {
      parseStatus: "parsed",
      semanticStatus: "semantic-fallback",
      fallbackReason: "main-not-in-candidates",
      rawMainType: "string",
      providerRawMain: "候補X",
    } satisfies PredictionAttemptProvenance;

    expect(result.attemptProvenance).toStrictEqual(expected);
    expect(result.output.main).toBe("候補A");
  }
);

test(
  "priority-2 canonical-before-blank: whitespace-only main present in candidates is canonical, not blank",
  () => {
    const result = parsePredictionOutputWithProvenance(
      JSON.stringify({ main: "   " }),
      ["   ", "候補B"]
    );

    const expected = {
      parseStatus: "parsed",
      semanticStatus: "canonical",
      rawMainType: "string",
      providerRawMain: "   ",
    } satisfies PredictionAttemptProvenance;

    expect(result.attemptProvenance).toStrictEqual(expected);
    expect(result.output.main).toBe("   ");
  }
);

test(
  "priority-2 canonical-before-blank: empty string main present in candidates is canonical, not blank",
  () => {
    const result = parsePredictionOutputWithProvenance(
      JSON.stringify({ main: "" }),
      ["", "候補B"]
    );

    const expected = {
      parseStatus: "parsed",
      semanticStatus: "canonical",
      rawMainType: "string",
      providerRawMain: "",
    } satisfies PredictionAttemptProvenance;

    expect(result.attemptProvenance).toStrictEqual(expected);
    expect(result.output.main).toBe("");
  }
);

test(
  "priority-1 json-parse-failed: empty candidates use the placeholder output main",
  () => {
    const result = parsePredictionOutputWithProvenance(
      "not json at all",
      []
    );

    const expected = {
      parseStatus: "json-parse-failed",
      semanticStatus: "semantic-fallback",
      fallbackReason: "json-parse-failed",
      rawMainType: "unavailable",
    } satisfies PredictionAttemptProvenance;

    expect(result.attemptProvenance).toStrictEqual(expected);
    expect(result.output.main).toBe("未定");
  }
);
