// Result write境界(admin application write-path)専用のpure builder(PR-2c)。
// React・Firestore・lib/events.ts・P6 parserへは一切依存しない(lib/result-write-guard.tsと同方針)。
// serverTimestamp()等のFirestore SentinelはFirestore依存の型として呼出し側が生成し、
// unknownとしてこのモジュールへ値渡しする(このモジュール自身はFirestore SDKをimportしない)。

// metadata: Result関連keyを一切書かない(既存Resultの保護・再構築禁止)。
// initial-settlement: 新規に初めてwinnerを確定させる。result全体を丸ごと書く(新規docへのsetまたは
//   result未設定/null docへのupdateを想定)。settledAtは呼出し側が生成した値をそのまま使う
//   (このモジュールではserverTimestamp/previous?.settledAtの推測を一切行わない)。
// single-winner-correction: 既存の単一winnerをA→Bへ訂正する。result.*のdot-pathのみを書き、
//   settledAtは書かない(欠損させたまま=既存値をFirestore側で自動的に保持させる)。
export type ResultWriteIntent =
  | { kind: "metadata" }
  | { kind: "initial-settlement"; winner: string; settledAt: unknown }
  | { kind: "single-winner-correction"; winner: string };

// intentからFirestore update()payloadの断片(Result関連部分のみ)を構築する。
// clear intentは存在しない(Result消去は各write-pathの既存guard/挙動に委ねる。このbuilderは
// 新しい消去能力を持たない)。
export function buildResultWriteUpdates(
  intent: ResultWriteIntent
): Record<string, unknown> {
  if (intent.kind === "metadata") {
    return {};
  }

  const winner = intent.winner.trim();
  if (!winner) {
    // {}へ縮退させない: identity書込みのつもりで空winnerが渡るのは呼出し側の契約違反。
    throw new Error("Result identity write requires a non-blank winner");
  }

  if (intent.kind === "initial-settlement") {
    if (intent.settledAt === undefined || intent.settledAt === null) {
      // undefined/nullがpayloadに紛れ込むのを防ぐ(Firestoreはundefinedフィールド値を拒否する)。
      throw new Error("Initial settlement requires a settledAt value");
    }

    return {
      result: {
        winner,
        winners: [winner],
        status: "settled",
        settledAt: intent.settledAt,
      },
    };
  }

  // single-winner-correction: dot-pathのみ。settledAtは含めない(既存値を欠損保持)。
  return {
    "result.winner": winner,
    "result.winners": [winner],
    "result.status": "settled",
  };
}
