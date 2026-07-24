import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  InitialSettlementConflictError,
  InitialSettlementValidationError,
} from "@/lib/result-initial-settlement";
import {
  InitialSettlementCandidateChangeError,
  runInitialSettlementTransaction,
  type InitialSettlementEditMetadataUpdates,
} from "@/lib/result-initial-settlement-transaction";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    "FIRESTORE_EMULATOR_HOST is required; refusing to run against a non-emulator target"
  );
}

const PROJECT_ID = "demo-kompari-pr2f2";
const ADMIN_EMAIL = "g0930035@gmail.com";
const BARRIER_TIMEOUT_MS = 5000;
const MATRIX_TEST_TIMEOUT_MS = 15000;

const BASELINE_TITLE = "PR-2f-2b Baseline";
const BASELINE_CATEGORY = "horse-racing";
const BASELINE_VENUE = "Baseline Venue";
const BASELINE_STARTS_AT = "2026-11-08T00:00:00.000Z";
const BASELINE_CANDIDATES = ["A", "B"];
const BASELINE_SOURCE = "manual-fixture";
const BASELINE_CREATION_SOURCE = "importer";

type EventFixture = {
  id: string;
  title: string;
  category: string;
  venue: string;
  startsAt: string;
  candidates: string[];
  result: null;
  source: string;
  creationSource: string;
  resultWinner?: string | number;
};

type EventFixtureOverrides = Omit<
  Partial<EventFixture>,
  "id" | "candidates"
> & {
  candidates?: string[];
};

type BarrierParticipant = "A" | "B";

type SettlementRequest = {
  requestedWinner: string;
};

function createFixture(
  eventId: string,
  overrides: EventFixtureOverrides = {}
): EventFixture {
  return {
    id: eventId,
    title: BASELINE_TITLE,
    category: BASELINE_CATEGORY,
    venue: BASELINE_VENUE,
    startsAt: BASELINE_STARTS_AT,
    result: null,
    source: BASELINE_SOURCE,
    creationSource: BASELINE_CREATION_SOURCE,
    ...overrides,
    candidates: [
      ...(overrides.candidates === undefined
        ? BASELINE_CANDIDATES
        : overrides.candidates),
    ],
  };
}

function createTwoParticipantBarrier(label: string, timeoutMs: number) {
  const arrived = new Set<BarrierParticipant>();
  let resolveGate: (() => void) | undefined;
  let rejectGate: ((reason: Error) => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;

  const gate = new Promise<void>((resolveGatePromise, rejectGatePromise) => {
    resolveGate = resolveGatePromise;
    rejectGate = rejectGatePromise;
  });

  function clearBarrierTimer() {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  async function wait(participant: string): Promise<void> {
    if (participant !== "A" && participant !== "B") {
      throw new Error(`Barrier ${label} received unknown participant`);
    }

    if (arrived.has(participant)) {
      throw new Error(
        `Barrier ${label} received duplicate participant ${participant}`
      );
    }

    arrived.add(participant);

    if (arrived.size === 1) {
      timer = setTimeout(() => {
        if (finished) return;

        finished = true;
        timer = undefined;
        const arrivedParticipants = [...arrived].sort().join(",");
        rejectGate?.(
          new Error(
            `Barrier ${label} timed out after ${timeoutMs}ms; arrived=${arrivedParticipants}`
          )
        );
      }, timeoutMs);
    }

    if (arrived.size === 2 && !finished) {
      finished = true;
      clearBarrierTimer();
      resolveGate?.();
    }

    await gate;
  }

  return {
    wait,
    getArrivedParticipants(): BarrierParticipant[] {
      return [...arrived].sort();
    },
    getArrivalCount(): number {
      return arrived.size;
    },
  };
}

function classifySettledTransactions(
  settledResults: PromiseSettledResult<{ winner: string }>[],
  requests: readonly SettlementRequest[]
) {
  expect(settledResults).toHaveLength(2);

  const fulfilledIndexes = settledResults.flatMap((result, index) =>
    result.status === "fulfilled" ? [index] : []
  );
  const rejectedIndexes = settledResults.flatMap((result, index) =>
    result.status === "rejected" ? [index] : []
  );

  expect(fulfilledIndexes).toHaveLength(1);
  expect(rejectedIndexes).toHaveLength(1);

  const fulfilledIndex = fulfilledIndexes[0];
  const rejectedIndex = rejectedIndexes[0];
  const fulfilledResult = settledResults[fulfilledIndex];
  const rejectedResult = settledResults[rejectedIndex];
  const winningWinner = requests[fulfilledIndex]?.requestedWinner;
  const losingWinner = requests[rejectedIndex]?.requestedWinner;

  if (
    fulfilledResult?.status !== "fulfilled" ||
    rejectedResult?.status !== "rejected" ||
    winningWinner === undefined ||
    losingWinner === undefined
  ) {
    throw new Error("Unexpected initial-settlement result classification");
  }

  expect(rejectedResult.reason).toBeInstanceOf(
    InitialSettlementConflictError
  );
  expect(rejectedResult.reason).not.toBeInstanceOf(
    InitialSettlementValidationError
  );
  expect(fulfilledResult.value.winner).toBe(winningWinner);

  return {
    fulfilledIndex,
    rejectedIndex,
    winningWinner,
    losingWinner,
    loserErrorName:
      rejectedResult.reason instanceof Error
        ? rejectedResult.reason.name
        : "NonErrorReason",
  };
}

function assertCanonicalResult(
  event: DocumentData,
  expectedWinner: string,
  losingWinner: string
) {
  const result = event.result;

  expect(result).not.toBeNull();
  expect(result).toBeDefined();

  if (result === null || result === undefined) {
    throw new Error("Expected a canonical Result");
  }

  expect(result.winner).toBe(expectedWinner);
  expect(result.winners).toStrictEqual([expectedWinner]);
  expect(result.status).toBe("settled");
  expect(result.settledAt).toBeDefined();
  expect(result.revision).toBeUndefined();
  expect(result.winners).not.toContain(losingWinner);
  expect(event.updatedAt).toBeDefined();
}

let testEnv: RulesTestEnvironment;

async function seedFixture(fixture: EventFixture): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "events", fixture.id),
      fixture
    );
  });
}

function createAdminEventRefs(eventId: string) {
  const contextA = testEnv.authenticatedContext("pr2f2-admin-a", {
    email: ADMIN_EMAIL,
  });
  const contextB = testEnv.authenticatedContext("pr2f2-admin-b", {
    email: ADMIN_EMAIL,
  });

  return {
    refA: doc(contextA.firestore(), "events", eventId),
    refB: doc(contextB.firestore(), "events", eventId),
  };
}

async function readEvent(eventId: string): Promise<DocumentData> {
  const context = testEnv.unauthenticatedContext();
  const snapshot = await getDoc(
    doc(context.firestore(), "events", eventId)
  );

  expect(snapshot.exists()).toBe(true);

  if (!snapshot.exists()) {
    throw new Error(`Event ${eventId} does not exist`);
  }

  return snapshot.data();
}

function expectBaselineMetadata(event: DocumentData) {
  expect(event.title).toBe(BASELINE_TITLE);
  expect(event.category).toBe(BASELINE_CATEGORY);
  expect(event.venue).toBe(BASELINE_VENUE);
  expect(event.startsAt).toBe(BASELINE_STARTS_AT);
  expect(event.candidates).toStrictEqual(BASELINE_CANDIDATES);
  expect(event.source).toBe(BASELINE_SOURCE);
  expect(event.creationSource).toBe(BASELINE_CREATION_SOURCE);
}

describe("initial-settlement transaction concurrency", () => {
  beforeAll(async () => {
    const rules = await readFile(resolve("firestore.rules"), "utf8");

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it(
    "allows exactly one initial settlement for results versus results",
    async () => {
      const eventId = "pr2f2-results-results";
      const fixture = createFixture(eventId);
      await seedFixture(fixture);

      const { refA, refB } = createAdminEventRefs(eventId);
      const barrier = createTwoParticipantBarrier(
        "results-results",
        BARRIER_TIMEOUT_MS
      );
      const requests = [
        { requestedWinner: "A" },
        { requestedWinner: "B" },
      ];

      const settledResults = await Promise.allSettled([
        runInitialSettlementTransaction({
          source: "results",
          eventRef: refA,
          nextWinner: requests[0].requestedWinner,
          afterFirstPlanBeforeWrite: () => barrier.wait("A"),
        }),
        runInitialSettlementTransaction({
          source: "results",
          eventRef: refB,
          nextWinner: requests[1].requestedWinner,
          afterFirstPlanBeforeWrite: () => barrier.wait("B"),
        }),
      ]);

      const outcome = classifySettledTransactions(
        settledResults,
        requests
      );
      const finalEvent = await readEvent(eventId);

      expect(barrier.getArrivedParticipants()).toStrictEqual(["A", "B"]);
      expect(barrier.getArrivalCount()).toBe(2);
      assertCanonicalResult(
        finalEvent,
        outcome.winningWinner,
        outcome.losingWinner
      );
      expectBaselineMetadata(finalEvent);
      console.info(
        `[results-results] winner=${outcome.winningWinner} loserError=${outcome.loserErrorName} barrier=A,B`
      );
    },
    MATRIX_TEST_TIMEOUT_MS
  );

  it(
    "allows exactly one atomic initial settlement for edit versus edit",
    async () => {
      const eventId = "pr2f2-edit-edit";
      const fixture = createFixture(eventId);
      await seedFixture(fixture);

      const { refA, refB } = createAdminEventRefs(eventId);
      const barrier = createTwoParticipantBarrier(
        "edit-edit",
        BARRIER_TIMEOUT_MS
      );
      const metadataA: InitialSettlementEditMetadataUpdates = {
        category: BASELINE_CATEGORY,
        title: "Edit Client A",
        venue: "Venue A",
        startsAt: "2026-11-09T00:00:00.000Z",
        candidates: [...BASELINE_CANDIDATES],
      };
      const metadataB: InitialSettlementEditMetadataUpdates = {
        category: BASELINE_CATEGORY,
        title: "Edit Client B",
        venue: "Venue B",
        startsAt: "2026-11-10T00:00:00.000Z",
        candidates: [...BASELINE_CANDIDATES],
      };
      const requests = [
        { requestedWinner: "A" },
        { requestedWinner: "B" },
      ];

      const settledResults = await Promise.allSettled([
        runInitialSettlementTransaction({
          source: "edit",
          eventRef: refA,
          nextWinner: requests[0].requestedWinner,
          metadataUpdates: metadataA,
          afterFirstPlanBeforeWrite: () => barrier.wait("A"),
        }),
        runInitialSettlementTransaction({
          source: "edit",
          eventRef: refB,
          nextWinner: requests[1].requestedWinner,
          metadataUpdates: metadataB,
          afterFirstPlanBeforeWrite: () => barrier.wait("B"),
        }),
      ]);

      const outcome = classifySettledTransactions(
        settledResults,
        requests
      );
      const finalEvent = await readEvent(eventId);
      const winningMetadata =
        outcome.fulfilledIndex === 0 ? metadataA : metadataB;
      const losingMetadata =
        outcome.rejectedIndex === 0 ? metadataA : metadataB;

      expect(barrier.getArrivedParticipants()).toStrictEqual(["A", "B"]);
      expect(barrier.getArrivalCount()).toBe(2);
      assertCanonicalResult(
        finalEvent,
        outcome.winningWinner,
        outcome.losingWinner
      );
      expect(finalEvent.title).toBe(winningMetadata.title);
      expect(finalEvent.venue).toBe(winningMetadata.venue);
      expect(finalEvent.startsAt).toBe(winningMetadata.startsAt);
      expect(finalEvent.category).toBe(winningMetadata.category);
      expect(finalEvent.candidates).toStrictEqual(
        winningMetadata.candidates
      );
      expect(finalEvent.title).not.toBe(losingMetadata.title);
      expect(finalEvent.venue).not.toBe(losingMetadata.venue);
      expect(finalEvent.startsAt).not.toBe(losingMetadata.startsAt);
      expect(finalEvent.source).toBe(BASELINE_SOURCE);
      expect(finalEvent.creationSource).toBe(BASELINE_CREATION_SOURCE);
      console.info(
        `[edit-edit] winner=${outcome.winningWinner} loserError=${outcome.loserErrorName} barrier=A,B`
      );
    },
    MATRIX_TEST_TIMEOUT_MS
  );

  it(
    "allows exactly one initial settlement for results versus edit",
    async () => {
      const eventId = "pr2f2-results-edit";
      const fixture = createFixture(eventId);
      await seedFixture(fixture);

      const { refA, refB } = createAdminEventRefs(eventId);
      const barrier = createTwoParticipantBarrier(
        "results-edit",
        BARRIER_TIMEOUT_MS
      );
      const editMetadata: InitialSettlementEditMetadataUpdates = {
        category: BASELINE_CATEGORY,
        title: "Cross Screen Edit",
        venue: "Cross Screen Venue",
        startsAt: "2026-11-11T00:00:00.000Z",
        candidates: [...BASELINE_CANDIDATES],
      };
      const requests = [
        { requestedWinner: "A" },
        { requestedWinner: "B" },
      ];

      const settledResults = await Promise.allSettled([
        runInitialSettlementTransaction({
          source: "results",
          eventRef: refA,
          nextWinner: requests[0].requestedWinner,
          afterFirstPlanBeforeWrite: () => barrier.wait("A"),
        }),
        runInitialSettlementTransaction({
          source: "edit",
          eventRef: refB,
          nextWinner: requests[1].requestedWinner,
          metadataUpdates: editMetadata,
          afterFirstPlanBeforeWrite: () => barrier.wait("B"),
        }),
      ]);

      const outcome = classifySettledTransactions(
        settledResults,
        requests
      );
      const finalEvent = await readEvent(eventId);

      expect(barrier.getArrivedParticipants()).toStrictEqual(["A", "B"]);
      expect(barrier.getArrivalCount()).toBe(2);
      assertCanonicalResult(
        finalEvent,
        outcome.winningWinner,
        outcome.losingWinner
      );

      if (outcome.fulfilledIndex === 0) {
        expectBaselineMetadata(finalEvent);
        expect(finalEvent.title).not.toBe(editMetadata.title);
        expect(finalEvent.venue).not.toBe(editMetadata.venue);
        expect(finalEvent.startsAt).not.toBe(editMetadata.startsAt);
      } else {
        expect(finalEvent.title).toBe(editMetadata.title);
        expect(finalEvent.venue).toBe(editMetadata.venue);
        expect(finalEvent.startsAt).toBe(editMetadata.startsAt);
        expect(finalEvent.category).toBe(editMetadata.category);
        expect(finalEvent.candidates).toStrictEqual(
          editMetadata.candidates
        );
        expect(finalEvent.source).toBe(BASELINE_SOURCE);
        expect(finalEvent.creationSource).toBe(
          BASELINE_CREATION_SOURCE
        );
      }

      console.info(
        `[results-edit] winner=${outcome.winningWinner} loserError=${outcome.loserErrorName} barrier=A,B`
      );
    },
    MATRIX_TEST_TIMEOUT_MS
  );

  it(
    "rejects edit candidate changes before planning or writing initial settlement",
    async () => {
      const eventId = "pr2f2-candidate-change";
      const fixture = createFixture(eventId);
      await seedFixture(fixture);

      const { refA } = createAdminEventRefs(eventId);
      let hookCalled = false;
      let caughtError: unknown;

      try {
        await runInitialSettlementTransaction({
          source: "edit",
          eventRef: refA,
          nextWinner: "D",
          metadataUpdates: {
            category: BASELINE_CATEGORY,
            title: "Must Not Persist",
            venue: "Must Not Persist Venue",
            startsAt: "2026-11-12T00:00:00.000Z",
            candidates: ["A", "B", "D"],
          },
          afterFirstPlanBeforeWrite: async () => {
            hookCalled = true;
          },
        });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(
        InitialSettlementCandidateChangeError
      );
      expect(caughtError).not.toBeInstanceOf(
        InitialSettlementConflictError
      );
      expect(hookCalled).toBe(false);
      expect(await readEvent(eventId)).toStrictEqual(fixture);
    }
  );

  it(
    "rejects a non-blank raw legacy resultWinner without writing",
    async () => {
      const eventId = "pr2f2-legacy-nonblank";
      const fixture = createFixture(eventId, { resultWinner: "A" });
      await seedFixture(fixture);

      const { refA } = createAdminEventRefs(eventId);
      let hookCalled = false;
      let caughtError: unknown;

      try {
        await runInitialSettlementTransaction({
          source: "results",
          eventRef: refA,
          nextWinner: "B",
          afterFirstPlanBeforeWrite: async () => {
            hookCalled = true;
          },
        });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(
        InitialSettlementConflictError
      );
      expect(hookCalled).toBe(false);
      expect(await readEvent(eventId)).toStrictEqual(fixture);
    }
  );

  it(
    "fails closed for a non-string raw legacy resultWinner without writing",
    async () => {
      const eventId = "pr2f2-legacy-nonstring";
      const fixture = createFixture(eventId, { resultWinner: 123 });
      await seedFixture(fixture);

      const { refA } = createAdminEventRefs(eventId);
      let hookCalled = false;
      let caughtError: unknown;

      try {
        await runInitialSettlementTransaction({
          source: "results",
          eventRef: refA,
          nextWinner: "B",
          afterFirstPlanBeforeWrite: async () => {
            hookCalled = true;
          },
        });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(
        InitialSettlementConflictError
      );
      expect(hookCalled).toBe(false);
      expect(await readEvent(eventId)).toStrictEqual(fixture);
    }
  );

  it(
    "allows initial settlement when raw legacy resultWinner is whitespace only",
    async () => {
      const eventId = "pr2f2-legacy-whitespace";
      const fixture = createFixture(eventId, { resultWinner: "   " });
      await seedFixture(fixture);

      const { refA } = createAdminEventRefs(eventId);
      const plan = await runInitialSettlementTransaction({
        source: "results",
        eventRef: refA,
        nextWinner: "B",
      });
      const finalEvent = await readEvent(eventId);

      expect(plan.winner).toBe("B");
      assertCanonicalResult(finalEvent, "B", "A");
      expectBaselineMetadata(finalEvent);
      expect(finalEvent.resultWinner).toBe("   ");
    }
  );
});
