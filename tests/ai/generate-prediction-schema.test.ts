import { expect, test } from "vitest";
import { GeneratePredictionResponseSchema } from "@/lib/ai/generate-prediction-schema";

// Assertion policy:
// - superRefine由来のrejectはissue件数とpathを固定する。
// - union / strict由来のrejectはsuccess === falseだけを固定する。
//   union不一致時のissue構造は未実測のため、pathとcodeを推測で固定しない。
// - undefined境界とfactor objectのunknown fieldはnegative caseではなく
//   positive boundaryとして固定する。
// - Candidate-set validation is a separate contract and remains outside TEST-2.

type MainNonStringRawType =
  | "null"
  | "number"
  | "boolean"
  | "array"
  | "object";

const canonicalAttempt = () => ({
  parseStatus: "parsed",
  semanticStatus: "canonical",
  rawMainType: "string",
  providerRawMain: "候補A",
});

const mainNonStringAttempt = (
  rawMainType: MainNonStringRawType
) => ({
  parseStatus: "parsed",
  semanticStatus: "semantic-fallback",
  fallbackReason: "main-non-string",
  rawMainType,
});

const countOneProvenance = () => ({
  version: 1,
  generationAttemptCount: 1,
  finalAttempt: canonicalAttempt(),
});

const countTwoProvenance = () => ({
  version: 1,
  generationAttemptCount: 2,
  initialMissingFields: ["reason"],
  initialAttempt: canonicalAttempt(),
  finalAttempt: canonicalAttempt(),
});

const minimalMock = () => ({
  ai: "テストAI",
  main: "候補A",
  predictionSource: "mock",
  isMock: true,
});

const minimalOfficialBase = () => ({
  ai: "テストAI",
  main: "候補A",
  predictionSource: "official-ai",
  isMock: false,
});

const minimalOfficial = () => ({
  ...minimalOfficialBase(),
  generationProvenance: countOneProvenance(),
});

test("accepts the minimal mock payload", () => {
  const payload = minimalMock();

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
});

test("accepts the minimal official-ai payload", () => {
  const payload = minimalOfficial();

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
});

test("accepts official-ai with a two-attempt provenance", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: countTwoProvenance(),
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
});

test("accepts json-parse-failed as final attempt", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countOneProvenance(),
      finalAttempt: {
        parseStatus: "json-parse-failed",
        semanticStatus: "semantic-fallback",
        fallbackReason: "json-parse-failed",
        rawMainType: "unavailable",
      },
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
});

test("accepts canonical as final attempt", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countOneProvenance(),
      finalAttempt: canonicalAttempt(),
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
});

test("accepts main-missing as final attempt", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countOneProvenance(),
      finalAttempt: {
        parseStatus: "parsed",
        semanticStatus: "semantic-fallback",
        fallbackReason: "main-missing",
        rawMainType: "missing",
      },
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
});

test("accepts null rawMainType in a main-non-string attempt", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countOneProvenance(),
      finalAttempt: mainNonStringAttempt("null"),
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
});

test("accepts number rawMainType in a main-non-string attempt", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countOneProvenance(),
      finalAttempt: mainNonStringAttempt("number"),
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
});

test("accepts boolean rawMainType in a main-non-string attempt", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countOneProvenance(),
      finalAttempt: mainNonStringAttempt("boolean"),
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
});

test("accepts array rawMainType in a main-non-string attempt", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countOneProvenance(),
      finalAttempt: mainNonStringAttempt("array"),
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
});

test("accepts object rawMainType in a main-non-string attempt", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countOneProvenance(),
      finalAttempt: mainNonStringAttempt("object"),
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
});

test("accepts main-blank as final attempt", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countOneProvenance(),
      finalAttempt: {
        parseStatus: "parsed",
        semanticStatus: "semantic-fallback",
        fallbackReason: "main-blank",
        rawMainType: "string",
        providerRawMain: "   ",
      },
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
});

test("accepts main-not-in-candidates as final attempt", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countOneProvenance(),
      finalAttempt: {
        parseStatus: "parsed",
        semanticStatus: "semantic-fallback",
        fallbackReason: "main-not-in-candidates",
        rawMainType: "string",
        providerRawMain: "候補X",
      },
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
});

test("rejects a payload missing ai", () => {
  const payload = {
    main: "候補A",
    predictionSource: "mock",
    isMock: true,
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("rejects an empty ai", () => {
  const payload = {
    ...minimalMock(),
    ai: "",
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("rejects a whitespace-only ai", () => {
  const payload = {
    ...minimalMock(),
    ai: "   ",
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("rejects a whitespace-only main", () => {
  const payload = {
    ...minimalMock(),
    main: "   ",
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("rejects an unknown prediction source", () => {
  const payload = {
    ...minimalMock(),
    predictionSource: "human",
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("keeps surrounding whitespace in ai without trimming", () => {
  const payload = {
    ...minimalMock(),
    ai: " A ",
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
  if (!result.success) return;

  expect(result.data.ai).toBe(" A ");
});

test("rejects official-ai without generationProvenance", () => {
  const payload = minimalOfficialBase();

  const expectedPaths = [["generationProvenance"]];

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
  if (result.success) return;

  expect(result.error.issues).toHaveLength(expectedPaths.length);
  expect(
    result.error.issues.map((issue) => issue.path)
  ).toEqual(expect.arrayContaining(expectedPaths));
});

test("rejects official-ai with isMock true", () => {
  const payload = {
    ...minimalOfficial(),
    isMock: true,
  };

  const expectedPaths = [["isMock"]];

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
  if (result.success) return;

  expect(result.error.issues).toHaveLength(expectedPaths.length);
  expect(
    result.error.issues.map((issue) => issue.path)
  ).toEqual(expect.arrayContaining(expectedPaths));
});

test("rejects official-ai with isMock true and no provenance", () => {
  const payload = {
    ...minimalOfficialBase(),
    isMock: true,
  };

  const expectedPaths = [
    ["isMock"],
    ["generationProvenance"],
  ];

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
  if (result.success) return;

  expect(result.error.issues).toHaveLength(expectedPaths.length);
  expect(
    result.error.issues.map((issue) => issue.path)
  ).toEqual(expect.arrayContaining(expectedPaths));
});

test("rejects mock with generationProvenance", () => {
  const payload = {
    ...minimalMock(),
    generationProvenance: countOneProvenance(),
  };

  const expectedPaths = [["generationProvenance"]];

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
  if (result.success) return;

  expect(result.error.issues).toHaveLength(expectedPaths.length);
  expect(
    result.error.issues.map((issue) => issue.path)
  ).toEqual(expect.arrayContaining(expectedPaths));
});

test("rejects mock with isMock false", () => {
  const payload = {
    ...minimalMock(),
    isMock: false,
  };

  const expectedPaths = [["isMock"]];

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
  if (result.success) return;

  expect(result.error.issues).toHaveLength(expectedPaths.length);
  expect(
    result.error.issues.map((issue) => issue.path)
  ).toEqual(expect.arrayContaining(expectedPaths));
});

test("rejects mock with isMock false and provenance", () => {
  const payload = {
    ...minimalMock(),
    isMock: false,
    generationProvenance: countOneProvenance(),
  };

  const expectedPaths = [
    ["isMock"],
    ["generationProvenance"],
  ];

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
  if (result.success) return;

  expect(result.error.issues).toHaveLength(expectedPaths.length);
  expect(
    result.error.issues.map((issue) => issue.path)
  ).toEqual(expect.arrayContaining(expectedPaths));
});

test("rejects an output wrapper object", () => {
  const payload = {
    ...minimalMock(),
    output: {},
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("rejects a null output wrapper", () => {
  const payload = {
    ...minimalMock(),
    output: null,
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("rejects a string output wrapper", () => {
  const payload = {
    ...minimalMock(),
    output: "leaked",
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("rejects an array output wrapper", () => {
  const payload = {
    ...minimalMock(),
    output: [],
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("rejects an attemptProvenance wrapper object", () => {
  const payload = {
    ...minimalMock(),
    attemptProvenance: canonicalAttempt(),
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

// Explicit undefined is not representable in JSON.
// This fixes the optional semantics boundary, not a wire-level payload case.
test("accepts an explicitly undefined output wrapper", () => {
  const payload = {
    ...minimalMock(),
    output: undefined,
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
});

test("rejects a canonical attempt carrying fallbackReason", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countOneProvenance(),
      finalAttempt: {
        ...canonicalAttempt(),
        fallbackReason: "main-blank",
      },
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("rejects a main-missing attempt carrying providerRawMain", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countOneProvenance(),
      finalAttempt: {
        parseStatus: "parsed",
        semanticStatus: "semantic-fallback",
        fallbackReason: "main-missing",
        rawMainType: "missing",
        providerRawMain: "候補A",
      },
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("rejects an unknown field inside an attempt branch", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countOneProvenance(),
      finalAttempt: {
        ...canonicalAttempt(),
        extra: 1,
      },
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("rejects contradictory attempt literals", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countOneProvenance(),
      finalAttempt: {
        ...canonicalAttempt(),
        parseStatus: "json-parse-failed",
      },
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("rejects a one-attempt provenance carrying initialAttempt", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countOneProvenance(),
      initialAttempt: canonicalAttempt(),
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("rejects a two-attempt provenance without initialMissingFields", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      version: 1,
      generationAttemptCount: 2,
      initialAttempt: canonicalAttempt(),
      finalAttempt: canonicalAttempt(),
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("rejects empty initialMissingFields", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countTwoProvenance(),
      initialMissingFields: [],
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("rejects reversed initialMissingFields", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countTwoProvenance(),
      initialMissingFields: ["evidence", "reason"],
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("rejects duplicated initialMissingFields", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countTwoProvenance(),
      initialMissingFields: ["reason", "reason"],
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("rejects an unknown generation attempt count", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countOneProvenance(),
      generationAttemptCount: 3,
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(false);
});

test("accepts evidence as the only initial missing field", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countTwoProvenance(),
      initialMissingFields: ["evidence"],
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
});

test("accepts reason and evidence as initial missing fields", () => {
  const payload = {
    ...minimalOfficial(),
    generationProvenance: {
      ...countTwoProvenance(),
      initialMissingFields: ["reason", "evidence"],
    },
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
});

test("preserves unknown top-level fields", () => {
  const payload = {
    ...minimalMock(),
    futureField: "kept",
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
  if (!result.success) return;

  expect(result.data["futureField"]).toBe("kept");
});

// This is a positive boundary test for the production schema.
// If the production schema does not strip this field, do not adjust the
// expectation before review.
test("strips unknown fields inside used factors", () => {
  const payload = {
    ...minimalMock(),
    usedFactors: [
      {
        key: "k",
        label: "L",
        direction: "positive",
        extra: "dropped",
      },
    ],
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
  if (!result.success) return;

  expect(result.data.usedFactors?.[0]).toStrictEqual({
    key: "k",
    label: "L",
    direction: "positive",
  });
});

// ai and main use nonBlankString, while second is z.string().optional().
test("accepts a blank second because it is not nonBlankString", () => {
  const payload = {
    ...minimalMock(),
    second: "",
  };

  const result =
    GeneratePredictionResponseSchema.safeParse(payload);

  expect(result.success).toBe(true);
});
