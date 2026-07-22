import { expect, test } from "vitest";

import type { KompariEvent } from "@/lib/events";
import {
  ResultRevisionConflictError,
  ResultRevisionValidationError,
  planSingleWinnerCorrection,
} from "@/lib/result-revision";

function settledEvent(
  resultOverrides: Partial<NonNullable<KompariEvent["result"]>> = {}
): KompariEvent {
  return {
    id: "event-1",
    category: "horse_racing",
    title: "Test Event",
    candidates: ["A", "B", "C"],
    predictions: [],
    result: {
      winner: "A",
      winners: ["A"],
      status: "settled",
      settledAt: { source: "test" },
      revision: 2,
      ...resultOverrides,
    },
  };
}

function plan(
  overrides: Partial<Parameters<typeof planSingleWinnerCorrection>[0]> = {}
) {
  return planSingleWinnerCorrection({
    freshEvent: settledEvent(),
    expectedOriginalWinner: "A",
    expectedRevision: 2,
    nextWinner: "B",
    ...overrides,
  });
}

function getThrownError(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    return error as Error;
  }

  throw new Error("Expected function to throw");
}

test("plans a correction when winner and revision both match", () => {
  const result = plan();

  expect(result).toStrictEqual({
    nextWinner: "B",
    before: { winner: "A", winners: ["A"], status: "settled" },
    after: { winner: "B", winners: ["B"], status: "settled" },
    nextRevision: 3,
  });
});

test("assigns revision 1 for the first correction of a legacy result", () => {
  const result = plan({
    freshEvent: settledEvent({ revision: undefined }),
    expectedRevision: 0,
  });

  expect(result.nextRevision).toBe(1);
  expect(result.before).toStrictEqual({
    winner: "A",
    winners: ["A"],
    status: "settled",
  });
  expect(result.after).toStrictEqual({
    winner: "B",
    winners: ["B"],
    status: "settled",
  });
});

test("reports a winner conflict before other correction validation", () => {
  const error = getThrownError(() =>
    plan({ expectedOriginalWinner: "B" })
  );

  expect(error).toBeInstanceOf(ResultRevisionConflictError);
  expect(error.message).toContain("winner");
});

test("reports a revision conflict when the winner returned to its expected value", () => {
  const error = getThrownError(() => plan({ expectedRevision: 1 }));

  expect(error).toBeInstanceOf(ResultRevisionConflictError);
  expect(error.message).toContain("revision");
});

test("prioritizes winner conflict when winner and revision both differ", () => {
  const error = getThrownError(() =>
    plan({ expectedOriginalWinner: "B", expectedRevision: 1 })
  );

  expect(error).toBeInstanceOf(ResultRevisionConflictError);
  expect(error.message).toContain("winner");
});

test("prioritizes revision conflict over no-op validation", () => {
  const error = getThrownError(() =>
    plan({ expectedRevision: 1, nextWinner: "A" })
  );

  expect(error).toBeInstanceOf(ResultRevisionConflictError);
  expect(error.message).toContain("revision");
});

test("prioritizes revision conflict over candidate validation", () => {
  const error = getThrownError(() =>
    plan({ expectedRevision: 1, nextWinner: "outside" })
  );

  expect(error).toBeInstanceOf(ResultRevisionConflictError);
  expect(error.message).toContain("revision");
});

test("prioritizes revision conflict over status validation", () => {
  const error = getThrownError(() =>
    plan({
      freshEvent: settledEvent({ status: "voided" }),
      expectedRevision: 1,
    })
  );

  expect(error).toBeInstanceOf(ResultRevisionConflictError);
  expect(error.message).toContain("revision");
});

test.each([
  ["negative", -1],
  ["fractional", 1.5],
  ["NaN", Number.NaN],
  ["Infinity", Number.POSITIVE_INFINITY],
  ["above MAX_SAFE_INTEGER", Number.MAX_SAFE_INTEGER + 1],
  ["runtime string", "1" as unknown as number],
])("rejects an invalid expected revision: %s", (_label, expectedRevision) => {
  const error = getThrownError(() => plan({ expectedRevision }));

  expect(error).toBeInstanceOf(ResultRevisionValidationError);
  expect(error.message).toContain("Expected revision");
});

test("prioritizes invalid expected revision over winner conflict", () => {
  const error = getThrownError(() =>
    plan({ expectedOriginalWinner: "B", expectedRevision: -1 })
  );

  expect(error).toBeInstanceOf(ResultRevisionValidationError);
  expect(error).not.toBeInstanceOf(ResultRevisionConflictError);
  expect(error.message).toContain("Expected revision");
});

test("keeps fresh revision runtime validation", () => {
  const error = getThrownError(() =>
    plan({
      freshEvent: settledEvent({ revision: "2" as unknown as number }),
    })
  );

  expect(error).toBeInstanceOf(ResultRevisionValidationError);
  expect(error.message).toContain("Result revision is invalid");
});

test("rejects overflow after a matching MAX_SAFE_INTEGER CAS", () => {
  const error = getThrownError(() =>
    plan({
      freshEvent: settledEvent({ revision: Number.MAX_SAFE_INTEGER }),
      expectedRevision: Number.MAX_SAFE_INTEGER,
    })
  );

  expect(error).toBeInstanceOf(ResultRevisionValidationError);
  expect(error.message).toContain("cannot be incremented safely");
});

test("keeps no-op validation after revision CAS succeeds", () => {
  const error = getThrownError(() => plan({ nextWinner: "A" }));

  expect(error).toBeInstanceOf(ResultRevisionValidationError);
  expect(error.message).toContain("no-op");
});

test("keeps candidate validation after revision CAS succeeds", () => {
  const error = getThrownError(() => plan({ nextWinner: "outside" }));

  expect(error).toBeInstanceOf(ResultRevisionValidationError);
  expect(error.message).toContain("outside candidates");
});

test("keeps status validation after revision CAS succeeds", () => {
  const error = getThrownError(() =>
    plan({ freshEvent: settledEvent({ status: "voided" }) })
  );

  expect(error).toBeInstanceOf(ResultRevisionValidationError);
  expect(error.message).toContain("not settled");
});
