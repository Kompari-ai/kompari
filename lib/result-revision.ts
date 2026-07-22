// Result訂正のrevision追跡専用のpure module(PR-2d-1)。
// React・Firestore write API(runTransaction等)へは依存しない。serverTimestamp()等の
// Firestore SentinelはcorrectedAtSentinelとしてunknownで値渡しされるのみ。
// PR-2d-1時点ではどのwrite-path/transaction/UIからも未配線(scaffoldingのみ)。

import {
  getResultWinner,
  getResultWinners,
  resolveResultStatus,
  type KompariEvent,
} from "@/lib/events";
import { findWinnersOutsideCandidates } from "@/lib/result-write-guard";

// ===== 3.1 domain error =====

export class ResultRevisionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResultRevisionValidationError";
  }
}

export class ResultRevisionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResultRevisionConflictError";
  }
}

// ===== 3.2 revision番号(safe integer・overflow・null拒否) =====

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ResultRevisionValidationError(
      `${label} must be a non-negative safe integer`
    );
  }
}

// event.result?.revision(raw, unknown)からcurrent revisionを解決する。
// undefined = 0(revision追跡導入前のlegacy/初回settlementデータ)。
// それ以外の型崩れ(負数・小数・文字列・NaN・Infinity・boolean等)は黙って0へ矯正せず、
// invalidとしてthrowする。
export function resolveCurrentRevision(raw: unknown): number {
  if (raw === undefined) return 0;
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < 0) {
    throw new ResultRevisionValidationError("Result revision is invalid");
  }
  return raw;
}

export function computeNextRevision(current: number): number {
  assertNonNegativeSafeInteger(current, "Current revision");
  if (current === Number.MAX_SAFE_INTEGER) {
    throw new ResultRevisionValidationError(
      "Result revision cannot be incremented safely"
    );
  }
  return current + 1;
}

// revision subcollectionの決定的docID。並び順のSoTにはしない(表示・queryはrevision fieldで行う)。
export function resultRevisionDocId(revision: number): string {
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new ResultRevisionValidationError(
      "Revision document ID requires a positive safe integer"
    );
  }
  return `rev-${String(revision).padStart(6, "0")}`;
}

// ===== 3.3 訂正可能shape述語(saveResult inlineと同一契約・共有SoT) =====

// app/admin/results/page.tsxのsaveResult内inline実装と同一契約のpure版。
// PR-2d-1時点ではsaveResultのinline実装はこの関数へ未接続(併存)。
export function canCorrectSingleWinner(event: KompariEvent): boolean {
  const legacyWinner = getResultWinner(event).trim();
  const rawWinners = event.result?.winners;
  const isLegacySingleWinner = rawWinners == null && legacyWinner !== "";
  const isCanonicalSyncedSingleWinner =
    Array.isArray(rawWinners) &&
    rawWinners.length === 1 &&
    typeof rawWinners[0] === "string" &&
    rawWinners[0].trim() !== "" &&
    rawWinners[0].trim() === legacyWinner;

  return (
    resolveResultStatus(event) === "settled" &&
    (isLegacySingleWinner || isCanonicalSyncedSingleWinner)
  );
}

// ===== 3.4 fresh検証＋訂正計画 =====

export type SingleWinnerCorrectionPlan = {
  nextWinner: string;
  before: { winner: string; winners: string[]; status: "settled" };
  after: { winner: string; winners: [string]; status: "settled" };
  nextRevision: number;
};

// transaction callback内でのfresh再検証を想定したpure関数(副作用なし)。
// UI側から渡されたexpectedOriginalWinnerとfreshEventのcanonical winnerを比較し、
// 不一致ならConflict(=他の変更と競合)、それ以外の入力不正・shape不正はValidationとして
// 明確に区別する。Conflict判定をshape判定より先に行う(winner不一致自体が最も重要な
// stale検出シグナルのため)。
export function planSingleWinnerCorrection(input: {
  freshEvent: KompariEvent;
  expectedOriginalWinner: string;
  expectedRevision: number;
  nextWinner: string;
}): SingleWinnerCorrectionPlan {
  const expectedWinner = input.expectedOriginalWinner.trim();
  if (!expectedWinner) {
    throw new ResultRevisionValidationError(
      "Expected original winner is required"
    );
  }

  assertNonNegativeSafeInteger(input.expectedRevision, "Expected revision");

  const freshWinner = getResultWinner(input.freshEvent).trim();

  if (freshWinner !== expectedWinner) {
    throw new ResultRevisionConflictError(
      "Result winner changed before correction"
    );
  }

  const freshRevision = resolveCurrentRevision(
    input.freshEvent.result?.revision
  );

  if (freshRevision !== input.expectedRevision) {
    throw new ResultRevisionConflictError(
      "Result revision changed before correction"
    );
  }

  if (resolveResultStatus(input.freshEvent) !== "settled") {
    throw new ResultRevisionValidationError("Result is not settled");
  }

  if (!canCorrectSingleWinner(input.freshEvent)) {
    throw new ResultRevisionValidationError(
      "Result is not a correctable single-winner shape"
    );
  }

  const nextWinner = input.nextWinner.trim();
  if (!nextWinner) {
    throw new ResultRevisionValidationError("Next winner is required");
  }

  if (nextWinner === freshWinner) {
    throw new ResultRevisionValidationError(
      "Next winner is identical (no-op)"
    );
  }

  if (
    findWinnersOutsideCandidates(
      [nextWinner],
      input.freshEvent.candidates ?? []
    ).length > 0
  ) {
    throw new ResultRevisionValidationError(
      "Next winner is outside candidates"
    );
  }

  const nextRevision = computeNextRevision(freshRevision);

  return {
    nextWinner,
    before: {
      winner: freshWinner,
      winners: getResultWinners(input.freshEvent),
      status: "settled",
    },
    after: {
      winner: nextWinner,
      winners: [nextWinner],
      status: "settled",
    },
    nextRevision,
  };
}

// ===== 3.5 revision entry構築 =====

function normalizeSettledSingleWinnerSnapshot(
  value: { winner: string; winners: readonly string[]; status: string },
  label: string
): { winner: string; winners: [string]; status: "settled" } {
  const winner = value.winner.trim();

  if (
    value.status !== "settled" ||
    !winner ||
    value.winners.length !== 1 ||
    typeof value.winners[0] !== "string" ||
    value.winners[0].trim() !== winner
  ) {
    throw new ResultRevisionValidationError(
      `${label} must be a synced settled single-winner snapshot`
    );
  }

  return { winner, winners: [winner], status: "settled" };
}

export type ResultRevisionCorrectedBy = { uid: string; email: string | null };

// revision subcollectionドキュメント本体を構築するpure関数。before/afterはruntime検証
// (synced settled single-winner shapeのみ許容)し、winners配列はコピーして返す
// (呼出し側の入力配列を変異させても返却値は変化しない)。correctedByはnull/undefinedなら
// キー自体を省略する(undefined値をpayloadへ混入させない)。
export function buildResultRevisionEntry(input: {
  revision: number;
  eventId: string;
  before: { winner: string; winners: string[]; status: "settled" };
  after: { winner: string; winners: [string]; status: "settled" };
  correctedAtSentinel: unknown;
  correctedBy?: ResultRevisionCorrectedBy | null;
}): Record<string, unknown> {
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
    throw new ResultRevisionValidationError(
      "Revision entry requires a positive safe integer"
    );
  }

  if (!input.eventId.trim()) {
    throw new ResultRevisionValidationError("Revision entry requires an event ID");
  }

  if (input.correctedAtSentinel === undefined || input.correctedAtSentinel === null) {
    throw new ResultRevisionValidationError("Revision entry requires correctedAt");
  }

  const before = normalizeSettledSingleWinnerSnapshot(input.before, "Before result");
  const after = normalizeSettledSingleWinnerSnapshot(input.after, "After result");

  if (before.winner === after.winner) {
    throw new ResultRevisionValidationError("Revision entry must change the winner");
  }

  const entry: Record<string, unknown> = {
    revision: input.revision,
    eventId: input.eventId,
    before,
    after,
    correctionReason: "manual-correction",
    correctedAt: input.correctedAtSentinel,
    schemaVersion: 1,
  };

  if (input.correctedBy) {
    if (!input.correctedBy.uid.trim()) {
      throw new ResultRevisionValidationError("correctedBy.uid must be non-blank");
    }
    if (
      input.correctedBy.email !== null &&
      typeof input.correctedBy.email !== "string"
    ) {
      throw new ResultRevisionValidationError(
        "correctedBy.email must be a string or null"
      );
    }

    entry.correctedBy = {
      uid: input.correctedBy.uid,
      email: input.correctedBy.email,
    };
  }

  return entry;
}
