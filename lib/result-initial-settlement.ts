import {
  getResultWinner,
  isResultTerminal,
  type KompariEvent,
} from "@/lib/events";
import { findWinnersOutsideCandidates } from "@/lib/result-write-guard";

export class InitialSettlementConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InitialSettlementConflictError";
  }
}

export class InitialSettlementValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InitialSettlementValidationError";
  }
}

export type InitialSettlementPlan = {
  winner: string;
};

export function planInitialSettlement(input: {
  freshEvent: KompariEvent;
  nextWinner: string;
}): InitialSettlementPlan {
  const result = input.freshEvent.result;
  const canSettleInitially =
    (result === null || result === undefined) &&
    getResultWinner(input.freshEvent) === "" &&
    !isResultTerminal(input.freshEvent);

  if (!canSettleInitially) {
    throw new InitialSettlementConflictError(
      "Result is no longer available for initial settlement"
    );
  }

  const winner = input.nextWinner.trim();

  if (!winner) {
    throw new InitialSettlementValidationError(
      "Initial settlement winner is required"
    );
  }

  const outsideWinners = findWinnersOutsideCandidates(
    [winner],
    input.freshEvent.candidates ?? []
  );

  if (outsideWinners.length > 0) {
    throw new InitialSettlementValidationError(
      "Initial settlement winner is outside candidates"
    );
  }

  return { winner };
}
