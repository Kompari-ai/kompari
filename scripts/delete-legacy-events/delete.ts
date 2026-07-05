// Guarded legacy event deletion script.
//
// デフォルト(引数なし、または --dry-run): dry-run。
//   events 全件を読み、source の有無で削除対象/残す対象に分類してログ出力するだけ。
//   Firestore の read は行うが、delete は一切実行しない。
//   (import.ts の dry-run と異なり、こちらは分類のために Firestore read が必須のため、
//    Admin SDK 初期化・読み取りは dry-run でも許容する。禁止しているのは delete のみ)
//
// --delete フラグ時のみ実際に削除する:
//   1. source が未設定/空の event を削除対象とする
//   2. events/{id}/predictions を先に全削除
//   3. predictions が空になったことを確認
//   4. events/{id} 本体を削除
//   predictions サブコレクション以外は触らない。
//
// 実行:
//   npx tsx scripts/delete-legacy-events/delete.ts             (dry-run)
//   npx tsx scripts/delete-legacy-events/delete.ts --dry-run    (dry-run)
//   npx tsx scripts/delete-legacy-events/delete.ts --delete     (実削除。人間のみ実行)
//
// 削除線引き(source フィールドの有無のみで機械判定。title/category/result等では判定しない):
//   削除対象: source が undefined | null | "" | 空白のみの文字列
//   残す:     source が非空文字列(例: "manual-fixture")
//
// 安全ガード:
//   - 削除は --delete 明示フラグ時のみ
//   - 削除対象が0件なら終了
//   - 削除対象が30件超なら異常とみなし停止
//   - source設定済みeventが削除対象に混入していたら停止
//   - predictions先、event本体後の順序を厳守(orphan回避)
//
// 注意(SDK/認証について):
//   Admin SDK(scripts/lib/admin.ts)を再利用する。GOOGLE_APPLICATION_CREDENTIALS
//   未設定の場合は getAdminFirestore() が明示的なエラーを投げて停止する。

import { getAdminFirestore } from "../lib/admin";

const DELETE_TARGET_LIMIT = 30;
const FIXTURE_ID = "fixture-sample-race-2026-11-08-01";

type Mode = "dry-run" | "delete";

function parseMode(): Mode {
  const args = process.argv.slice(2);
  return args.includes("--delete") ? "delete" : "dry-run";
}

type EventSummary = {
  id: string;
  title: string;
  category: string;
  source: unknown;
  sourceId: unknown;
  creationSource: unknown;
  predictionCountField: unknown;
  actualPredictionDocsCount: number;
};

// source未設定/空の判定。この判定だけで削除対象を決める(title/category等は見ない)。
function isSourceUnset(source: unknown): boolean {
  if (source === undefined || source === null) return true;
  if (typeof source === "string" && source.trim() === "") return true;
  return false;
}

async function main() {
  const mode = parseMode();

  console.log(`=== Legacy Event Deletion (mode: ${mode}) ===`);

  const firestore = getAdminFirestore();

  const eventsSnapshot = await firestore.collection("events").get();

  const deleteTargets: EventSummary[] = [];
  const keepTargets: EventSummary[] = [];

  for (const eventDoc of eventsSnapshot.docs) {
    const data = eventDoc.data();

    const predictionsSnapshot = await firestore
      .collection("events")
      .doc(eventDoc.id)
      .collection("predictions")
      .get();

    const summary: EventSummary = {
      id: eventDoc.id,
      title: data.title ?? "(no title)",
      category: data.category ?? "(no category)",
      source: data.source,
      sourceId: data.sourceId,
      creationSource: data.creationSource,
      predictionCountField: data.predictionCount,
      actualPredictionDocsCount: predictionsSnapshot.size,
    };

    if (isSourceUnset(data.source)) {
      deleteTargets.push(summary);
    } else {
      keepTargets.push(summary);
    }
  }

  console.log(`\n--- 削除対象 (source未設定/空): ${deleteTargets.length}件 ---`);
  deleteTargets.forEach((e) => {
    console.log(
      `  id=${e.id} title=${e.title} category=${e.category} source=${JSON.stringify(
        e.source
      )} predictionCount(field)=${e.predictionCountField} predictions(実件数)=${
        e.actualPredictionDocsCount
      }`
    );
  });

  console.log(`\n--- 残す対象 (source設定済み): ${keepTargets.length}件 ---`);
  keepTargets.forEach((e) => {
    console.log(
      `  id=${e.id} title=${e.title} source=${e.source} sourceId=${e.sourceId} creationSource=${e.creationSource}`
    );
  });

  const fixtureInKeep = keepTargets.some((e) => e.id === FIXTURE_ID);
  const fixtureInDelete = deleteTargets.some((e) => e.id === FIXTURE_ID);

  console.log(`\n${FIXTURE_ID} は残す対象にあるか: ${fixtureInKeep}`);
  if (fixtureInDelete) {
    console.log(`警告: ${FIXTURE_ID} が削除対象に混入しています。`);
  }

  if (mode === "dry-run") {
    console.log("\ndry-run: Firestoreには削除を書き込んでいません。");
    console.log("実削除するには --delete を付けて人間が手動実行してください。");
    return;
  }

  // --- ここから --delete モード ---

  if (deleteTargets.length === 0) {
    console.log("\n削除対象なし。終了します。");
    return;
  }

  if (deleteTargets.length > DELETE_TARGET_LIMIT) {
    console.log(
      `\n削除対象が${deleteTargets.length}件で上限(${DELETE_TARGET_LIMIT}件)を超えています。` +
        "異常とみなし停止します。"
    );
    return;
  }

  if (fixtureInDelete) {
    console.log(`\n${FIXTURE_ID} が削除対象に含まれているため停止します。`);
    return;
  }

  const contaminated = deleteTargets.filter((e) => !isSourceUnset(e.source));
  if (contaminated.length > 0) {
    console.log("\nsource設定済みeventが削除対象に混入しています。停止します。");
    contaminated.forEach((e) => console.log(`  id=${e.id} source=${e.source}`));
    return;
  }

  let deletedPredictionsCount = 0;
  let deletedEventsCount = 0;

  for (const target of deleteTargets) {
    const eventRef = firestore.collection("events").doc(target.id);
    const predictionsRef = eventRef.collection("predictions");

    const predictionsSnapshot = await predictionsRef.get();
    for (const predDoc of predictionsSnapshot.docs) {
      await predDoc.ref.delete();
      deletedPredictionsCount += 1;
    }

    const verifySnapshot = await predictionsRef.get();
    if (!verifySnapshot.empty) {
      console.log(
        `\nevents/${target.id}/predictions が空になっていません。event本体の削除をスキップします。`
      );
      continue;
    }

    await eventRef.delete();
    deletedEventsCount += 1;
    console.log(`\nevents/${target.id} (${target.title}) を削除しました。`);
  }

  console.log("\n=== summary ===");
  console.log(`削除対象: ${deleteTargets.length}件`);
  console.log(`残す: ${keepTargets.length}件`);
  console.log(`削除した predictions docs: ${deletedPredictionsCount}件`);
  console.log(`削除した events: ${deletedEventsCount}件`);
  console.log(`残した source付き events: ${keepTargets.length}件`);
}

main();
