// Guarded event importer.
//
// デフォルト(引数なし、または --dry-run): dry-run。
//   sample fixture を読み、event draft に変換し、ログ出力するだけ。
//   Firestore 関連の import は一切発生しない(下記 writeToFirestore 参照)。
//
// --write フラグ時のみ Firestore write 経路を通る:
//   1. events/{deterministic id} を transaction 内で get
//   2. 存在する → skip(上書きしない)
//   3. 存在しない → create(get→create を同一 transaction で atomic に行う)
//   predictions サブコレクションには一切触れない。
//
// 実行:
//   npx tsx scripts/import-events/import.ts             (dry-run)
//   npx tsx scripts/import-events/import.ts --dry-run    (dry-run)
//   npx tsx scripts/import-events/import.ts --write      (実書き込み)
//
// 注意(SDK/認証について):
//   このスクリプトは firebase-admin ではなく、既存の client SDK(lib/firebase.ts の db)を使う。
//   firebase-admin は package.json に存在せず、サービスアカウント鍵も本リポジトリに無いため、
//   今回は追加していない(勝手な依存・認証情報の追加はしない方針)。
//   Firestore rules は events の create に isAdmin()(管理者メールでの認証)を要求するため、
//   本スクリプトを認証なしで --write 実行すると permission-denied で失敗する見込みが高い。
//   実際に書き込むには、管理者として認証された Firebase セッションを別途用意するか、
//   firebase-admin + サービスアカウント鍵を整備するか、のプロダクト判断が必要。
//   このスクリプトはその判断より先には進まない(認証機構の追加は行わない)。

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  convertRawEventSource,
  type ConvertResult,
  type RawEventSource,
} from "../../lib/event-import";

const FIXTURE_PATH = join(
  process.cwd(),
  "fixtures/events/horse-racing/sample-race.json"
);

type Mode = "dry-run" | "write";

function parseMode(): Mode {
  const args = process.argv.slice(2);
  return args.includes("--write") ? "write" : "dry-run";
}

function loadFixture(): RawEventSource {
  const raw = readFileSync(FIXTURE_PATH, "utf-8");
  return JSON.parse(raw) as RawEventSource;
}

function logDraft(result: ConvertResult) {
  if (result.ok) {
    console.log("変換成功:");
    console.log(JSON.stringify(result.event, null, 2));
  } else {
    console.log(`変換失敗: ${result.reason} (sourceId: ${result.sourceId})`);
  }
}

// --write モード専用。Firestore関連の import はこの関数の中でのみ行う。
// dry-run モードではこの関数自体が呼ばれないため、firebase/firestore は一切ロードされない。
async function writeToFirestore(result: ConvertResult): Promise<void> {
  if (!result.ok) {
    console.log("変換失敗のため書き込みをスキップします。");
    return;
  }

  const { doc, runTransaction, serverTimestamp } = await import(
    "firebase/firestore"
  );
  const { db } = await import("../../lib/firebase");

  const event = result.event;
  const eventId = event.id;

  console.log(`\nこれから events/${eventId} に書き込みます`);
  console.log(`  sourceId: ${event.sourceId}`);
  console.log(`  title: ${event.title}`);
  console.log(`  candidates件数: ${event.candidates.length}`);
  console.log("  predictions は作成しません。");

  const eventRef = doc(db, "events", eventId);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(eventRef);

    if (existing.exists()) {
      console.log(
        `\nevents/${eventId} は既に存在します。skip します(上書きしません)。`
      );
      return;
    }

    transaction.set(eventRef, {
      slug: event.slug,
      category: event.category,
      title: event.title,
      candidates: event.candidates,
      venue: event.venue,
      startsAt: event.startsAt,
      // 取り込み時点では未確定。空文字列は入れない。
      result: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      predictionCount: 0,
      source: event.source,
      sourceId: event.sourceId,
      sourceUrl: event.sourceUrl,
      creationSource: event.creationSource,
    });

    console.log(
      `\nevents/${eventId} を作成しました。predictions は作成していません。`
    );
  });
}

async function main() {
  const mode = parseMode();

  console.log(`=== Event Importer (mode: ${mode}) ===`);

  const raw = loadFixture();
  const result = convertRawEventSource(raw);

  logDraft(result);

  if (mode === "dry-run") {
    console.log("\ndry-run: Firestoreには書き込んでいません。");
    if (result.ok) {
      console.log(`--write なら events/${result.event.id} に create します。`);
    }
    return;
  }

  await writeToFirestore(result);
}

main();
