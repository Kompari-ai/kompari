import {
  runTransaction,
  serverTimestamp,
  type DocumentReference,
} from "firebase/firestore";

import {
  normalizeEventDocToEvent,
  type KompariEventDoc,
} from "@/lib/events";
import {
  InitialSettlementConflictError,
  planInitialSettlement,
  type InitialSettlementPlan,
} from "@/lib/result-initial-settlement";
import { buildResultWriteUpdates } from "@/lib/result-write";
import { areCandidateListsEqual } from "@/lib/result-write-guard";

export type InitialSettlementEditMetadataUpdates = {
  category: string;
  title: string;
  venue: string;
  startsAt: string | null;
  candidates: string[];
};

export class InitialSettlementCandidateChangeError extends Error {
  constructor() {
    super("Candidates must be saved before performing initial settlement");
    this.name = "InitialSettlementCandidateChangeError";
  }
}

export type RunInitialSettlementTransactionInput = {
  eventRef: DocumentReference;
  nextWinner: string;
  afterFirstPlanBeforeWrite?: () => Promise<void>;
} & (
  | {
      source: "results";
    }
  | {
      source: "edit";
      metadataUpdates: InitialSettlementEditMetadataUpdates;
    }
);

export async function runInitialSettlementTransaction(
  input: RunInitialSettlementTransactionInput
): Promise<InitialSettlementPlan> {
  const fixedInput: RunInitialSettlementTransactionInput =
    input.source === "edit"
      ? {
          ...input,
          metadataUpdates: {
            ...input.metadataUpdates,
            candidates: [...input.metadataUpdates.candidates],
          },
        }
      : input;
  let attempt = 0;

  return runTransaction(fixedInput.eventRef.firestore, async (transaction) => {
    attempt += 1;

    const snapshot = await transaction.get(fixedInput.eventRef);

    if (!snapshot.exists()) {
      throw new InitialSettlementConflictError("Event not found");
    }

    const raw = snapshot.data();
    const hasLegacyResultWinner = Object.prototype.hasOwnProperty.call(
      raw,
      "resultWinner"
    );
    let legacyResultWinner: string | undefined;

    if (hasLegacyResultWinner) {
      if (typeof raw.resultWinner !== "string") {
        throw new InitialSettlementConflictError(
          "Legacy resultWinner has an invalid shape"
        );
      }

      legacyResultWinner = raw.resultWinner;
    }

    const freshEventDoc = {
      ...raw,
      id: fixedInput.eventRef.id,
    } as KompariEventDoc;
    const normalizedEvent = normalizeEventDocToEvent(freshEventDoc, []);
    const freshEvent =
      legacyResultWinner === undefined
        ? normalizedEvent
        : {
            ...normalizedEvent,
            resultWinner: legacyResultWinner,
          };

    if (
      fixedInput.source === "edit" &&
      !areCandidateListsEqual(
        freshEvent.candidates,
        fixedInput.metadataUpdates.candidates
      )
    ) {
      throw new InitialSettlementCandidateChangeError();
    }

    const plan = planInitialSettlement({
      freshEvent,
      nextWinner: fixedInput.nextWinner,
    });

    if (attempt === 1) {
      await fixedInput.afterFirstPlanBeforeWrite?.();
    }

    const resultUpdates = buildResultWriteUpdates({
      kind: "initial-settlement",
      winner: plan.winner,
      settledAt: serverTimestamp(),
    });

    transaction.update(fixedInput.eventRef, {
      ...(fixedInput.source === "edit" ? fixedInput.metadataUpdates : {}),
      ...resultUpdates,
      updatedAt: serverTimestamp(),
    });

    return plan;
  });
}
