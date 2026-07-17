// Result write境界(admin application write-path)専用のpure helper。
// React・Firestore・lib/events.ts・P6 parserへは一切依存しない。
// 各write-path固有の遷移条件(settlement判定・legacy例外・confirm)は呼出し側で組み合わせる。

export type ResultWriteGuardReason =
  | "winner-outside-candidates"
  | "settled-event-identity-change"
  | "settled-result-clear";

// candidates配列の同一性判定。配列順を含む完全一致のみをtrueとする。
// trim・sort・重複除去・case変換・Unicode normalizationはいずれも行わない。
export function areCandidateListsEqual(
  original: string[],
  next: string[]
): boolean {
  return (
    original.length === next.length &&
    original.every((candidate, index) => candidate === next[index])
  );
}

// winnerが候補一覧に含まれない状態かを判定する。
// winnerが空文字の場合は判定対象外としてfalseを返す。
// trimはこのhelper内では行わない。呼出し側がcanonical winnerまたは保存予定のtrim済みwinnerを渡す。
export function isWinnerOutsideCandidates(
  winner: string,
  candidates: string[]
): boolean {
  return winner !== "" && !candidates.includes(winner);
}
