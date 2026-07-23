import { expect, test } from "vitest";

import type { KompariEvent } from "@/lib/events";
import {
  InitialSettlementConflictError,
  InitialSettlementValidationError,
  planInitialSettlement,
} from "@/lib/result-initial-settlement";

type RuntimeResult = KompariEvent["result"] | null;

function pendingEvent(
  overrides: Omit<Partial<KompariEvent>, "result"> & {
    result?: RuntimeResult;
  } = {}
): KompariEvent {
  return {
    id: "event-1",
    category: "horse_racing",
    title: "Test Event",
    candidates: ["A", "B", "C"],
    predictions: [],
    ...overrides,
  } as KompariEvent;
}

function plan(
  overrides: Partial<Parameters<typeof planInitialSettlement>[0]> = {}
) {
  return planInitialSettlement({
    freshEvent: pendingEvent(),
    nextWinner: "A",
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

test("plans an initial settlement when result is undefined", () => {
  expect(plan()).toStrictEqual({ winner: "A" });
});

test("plans an initial settlement when result is null", () => {
  expect(
    plan({
      freshEvent: pendingEvent({ result: null }),
    })
  ).toStrictEqual({ winner: "A" });
});

test("returns the trimmed canonical winner", () => {
  expect(plan({ nextWinner: "  A  " })).toStrictEqual({ winner: "A" });
});

test.each([
  ["empty", ""],
  ["whitespace-only", "   "],
])("rejects a %s winner", (_label, nextWinner) => {
  const error = getThrownError(() => plan({ nextWinner }));

  expect(error).toBeInstanceOf(InitialSettlementValidationError);
  expect(error).not.toBeInstanceOf(InitialSettlementConflictError);
  expect(error.message).toContain("required");
});

test("rejects a winner outside candidates", () => {
  const error = getThrownError(() => plan({ nextWinner: "Outside" }));

  expect(error).toBeInstanceOf(InitialSettlementValidationError);
  expect(error.message).toContain("outside candidates");
});

test("requires an exact case-sensitive candidate match", () => {
  const error = getThrownError(() =>
    plan({
      freshEvent: pendingEvent({ candidates: ["Alpha"] }),
      nextWinner: "alpha",
    })
  );

  expect(error).toBeInstanceOf(InitialSettlementValidationError);
  expect(error.message).toContain("outside candidates");
});

const conflictResults: Array<[string, NonNullable<KompariEvent["result"]>]> = [
  ["empty object", {}],
  ["blank winner", { winner: "" }],
  ["winner", { winner: "A" }],
  ["empty winners", { winners: [] }],
  ["winners", { winners: ["A"] }],
  ["postponed status", { status: "postponed" }],
  ["settledAt", { settledAt: { source: "test" } }],
  ["zero revision", { revision: 0 }],
  ["positive revision", { revision: 1 }],
  [
    "complete settled result",
    {
      winner: "A",
      winners: ["A"],
      status: "settled",
      settledAt: { source: "test" },
      revision: 1,
    },
  ],
];

test.each(conflictResults)("rejects a non-empty result shape: %s", (_label, result) => {
  const error = getThrownError(() =>
    plan({
      freshEvent: pendingEvent({ result }),
    })
  );

  expect(error).toBeInstanceOf(InitialSettlementConflictError);
  expect(error).not.toBeInstanceOf(InitialSettlementValidationError);
});

test("rejects a legacy top-level winner when result is undefined", () => {
  const error = getThrownError(() =>
    plan({
      freshEvent: pendingEvent({ resultWinner: "A" }),
    })
  );

  expect(error).toBeInstanceOf(InitialSettlementConflictError);
});

test("prioritizes conflict over blank winner validation", () => {
  const error = getThrownError(() =>
    plan({
      freshEvent: pendingEvent({ result: {} }),
      nextWinner: "",
    })
  );

  expect(error).toBeInstanceOf(InitialSettlementConflictError);
  expect(error).not.toBeInstanceOf(InitialSettlementValidationError);
});

test("prioritizes conflict over candidate membership validation", () => {
  const error = getThrownError(() =>
    plan({
      freshEvent: pendingEvent({ result: {} }),
      nextWinner: "Outside",
    })
  );

  expect(error).toBeInstanceOf(InitialSettlementConflictError);
  expect(error).not.toBeInstanceOf(InitialSettlementValidationError);
});

test("does not mutate the Event or its candidates", () => {
  const freshEvent = pendingEvent();
  const eventBefore = structuredClone(freshEvent);
  const candidatesBefore = [...freshEvent.candidates];

  const result = planInitialSettlement({
    freshEvent,
    nextWinner: "  A  ",
  });

  expect(result).toStrictEqual({ winner: "A" });
  expect(freshEvent).toStrictEqual(eventBefore);
  expect(freshEvent.candidates).toStrictEqual(candidatesBefore);
});
