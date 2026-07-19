import { expect, test } from "vitest";
import { parsePredictionOutputWithProvenance } from "@/lib/ai/parse";

test("parser module is importable and returns canonical provenance", () => {
  const result = parsePredictionOutputWithProvenance(
    JSON.stringify({ main: "候補A" }),
    ["候補A", "候補B"]
  );

  expect(result.output.main).toBe("候補A");
  expect(result.attemptProvenance.semanticStatus).toBe("canonical");
});
